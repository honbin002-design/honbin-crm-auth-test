import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isRootOwnerIdentity,ownerMemberService,ROOT_OWNER_EMAIL}
 from './firebase-owner-member-service.mjs';
const source=readFileSync('firebase-owner-member-service.mjs','utf8');
const html=readFileSync('workspace-v2.html','utf8');
assert.equal(ROOT_OWNER_EMAIL,'honbin002@gmail.com');
assert.equal(isRootOwnerIdentity({uid:'owner_123',email:ROOT_OWNER_EMAIL,
 emailVerified:true,providerId:'google.com'}),true);
assert.equal(isRootOwnerIdentity({uid:'owner_123',email:'another@gmail.com',
 emailVerified:true,providerId:'google.com'}),false);
assert.equal(isRootOwnerIdentity({uid:'owner_123',email:ROOT_OWNER_EMAIL,
 emailVerified:false,providerId:'google.com'}),false);
assert.match(source,/getDocFromServer/);
assert.match(source,/await runTransaction/);
assert.match(source,/tx.update\(member,\{role:nextRole\}\)/);
assert.doesNotMatch(source,/deleteDoc|setDoc|batch\.set/);
assert.match(html,/id="ownerManagement" hidden/);
assert.match(html,/isRootOwnerIdentity\(rootIdentity\)/);
assert.match(html,/ownerMembers\.changeRole/);
assert.match(html,/expectedRole:member\.role/);
assert.match(html,/id="ownerGroup"/);
assert.match(html,/id="ownerMembers"/);
assert.doesNotMatch(html,/ownerMembers\.changeMember/);
let liveUid='owner_123',writeCount=0;
const groups='groups/testgroup';
const members=groups+'/members/member_456';
const sent=groups+'/sentInvites/invite_789';
const inbox='inboxes/member@example.com/invites/invite_789';
const docs=new Map([
 [groups,{ownerUid:'owner_123',name:'測試共用記事'}],
 [members,{uid:'member_456',role:'VIEWER',status:'ACTIVE',invitationId:'invite_789'}],
 [sent,{groupId:'testgroup',recipientEmail:'member@example.com'}],
 [inbox,{groupId:'testgroup',recipientEmail:'member@example.com',
   status:'ACCEPTED',acceptedUid:'member_456'}]
]);
const snap=(path)=>({
 id:path.split('/').at(-1),
 exists:()=>docs.has(path),
 data:()=>structuredClone(docs.get(path))
});
const mockSdk={
 doc(_db,...parts){return {path:parts.join('/')}},
 collection(_db,...parts){return {path:parts.join('/')}},
 async getDocFromServer(ref){return snap(ref.path)},
 async getDocs(ref){
  const prefix=ref.path+'/';
  const hits=[...docs.keys()].filter(path=>path.startsWith(prefix)&&
    !path.slice(prefix.length).includes('/'));
  return {docs:hits.map(snap)};
 },
 async runTransaction(_db,callback){
  const ops=[];
  const result=await callback({
   async get(ref){return snap(ref.path)},
   update(ref,changes){ops.push({path:ref.path,changes})}
  });
  for(const op of ops){
   assert.equal(op.path,members,'Only selected membership may be changed');
   assert.deepEqual(Object.keys(op.changes),['role']);
   docs.set(op.path,{...docs.get(op.path),...op.changes});writeCount++;
  }
  return result;
 }
};
const identity={uid:'owner_123',email:ROOT_OWNER_EMAIL,emailVerified:true,providerId:'google.com'};
const service=ownerMemberService({db:{},sdk:mockSdk,identity,currentUid:()=>liveUid});
const owned=await service.ownedGroups([{id:'testgroup',name:'index-view'}]);
assert.deepEqual(owned,[{id:'testgroup',name:'測試共用記事'}]);
const snapshot=await service.roster('testgroup');
assert.equal(snapshot.members.length,1);
assert.equal(snapshot.members[0].email,'member@example.com');
assert.equal(snapshot.members[0].role,'VIEWER');
assert.equal(snapshot.members[0].editable,true);
assert.equal(writeCount,0,'Inventory must have zero writes');
const change={groupId:'testgroup',memberUid:'member_456',invitationId:'invite_789',
 recipientEmail:'member@example.com',expectedRole:'VIEWER',nextRole:'EDITOR'};
const result=await service.changeRole(change);
assert.equal(result.role,'EDITOR');
assert.equal(writeCount,1);
assert.equal(docs.get(members).role,'EDITOR');
await assert.rejects(service.changeRole(change),/MEMBERSHIP_CHANGED_STOP/);
assert.equal(writeCount,1,'Stale role must be rejected without writing');
await assert.rejects(service.changeRole({...change,memberUid:'owner_123'}),/INVALID_ROLE_CHANGE/);
await assert.rejects(service.changeRole({...change,expectedRole:'EDITOR',
 recipientEmail:'wrong@example.com',nextRole:'ADMIN'}),/INVITATION_LINK_MISMATCH|ACCEPTED_INVITE_MISMATCH/);
assert.equal(writeCount,1);
liveUid='other_999';
await assert.rejects(service.roster('testgroup'),/ACCOUNT_CHANGED/);
await assert.rejects(service.changeRole({...change,expectedRole:'EDITOR',
 nextRole:'ADMIN'}),/ACCOUNT_CHANGED/);
assert.equal(writeCount,1);
assert.throws(()=>ownerMemberService({db:{},sdk:mockSdk,
 identity:{...identity,email:'other@gmail.com'},currentUid:()=>liveUid}),
 /VERIFIED_ROOT_OWNER_REQUIRED/);
console.log('OWNER_ONLY_MEMBER_ROLE_CONTROL_PASS');
