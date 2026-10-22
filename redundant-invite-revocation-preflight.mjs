// No Firebase connection: prove only an obsolete PENDING invite status can change.
import assert from 'node:assert/strict';
import {ownerMemberService,ROOT_OWNER_EMAIL} from './firebase-owner-member-service.mjs';
const ROOT='rootuid',GROUP='bookA',MEMBER='userB';
const EMAIL='member@example.test';
const owner={uid:ROOT,email:ROOT_OWNER_EMAIL,emailVerified:true,providerId:'google.com'};
function setup(){
 const base='groups/'+GROUP,accepted='joinedOnce',old='staleViewer';
 const acceptedPath='inboxes/'+EMAIL+'/invites/'+accepted;
 const pendingPath='inboxes/'+EMAIL+'/invites/'+old;
 const docs=new Map([
  [base,{ownerUid:ROOT,name:'synthetic notebook'}],
  [base+'/members/'+MEMBER,{uid:MEMBER,role:'EDITOR',status:'ACTIVE',invitationId:accepted}],
  [base+'/sentInvites/'+accepted,{groupId:GROUP,recipientEmail:EMAIL}],
  [acceptedPath,{groupId:GROUP,recipientEmail:EMAIL,status:'ACCEPTED',acceptedUid:MEMBER}],
  [base+'/sentInvites/'+old,{groupId:GROUP,recipientEmail:EMAIL}],
  [pendingPath,{groupId:GROUP,recipientEmail:EMAIL,status:'PENDING',role:'VIEWER'}]
 ]);
 const snapshot=p=>({exists:()=>docs.has(p),data:()=>structuredClone(docs.get(p))});
 const writes=[];
 let current=ROOT;
 const sdk={
  doc:(_db,...parts)=>({path:parts.join('/')}),
  collection:(_db,...parts)=>({path:parts.join('/')}),
  getDocFromServer:async ref=>snapshot(ref.path),
  getDocs:async ref=>({docs:[...docs.keys()].filter(x=>x.startsWith(ref.path+'/')).map(x=>({
   id:x.split('/').at(-1),data:()=>docs.get(x)
  }))}),
  runTransaction:async(_db,cb)=>{
   const staged=[];
   const answer=await cb({
    get:async ref=>snapshot(ref.path),
    update:(ref,changes)=>staged.push({path:ref.path,changes})
   });
   for(const write of staged){
    assert.equal(write.path,pendingPath,'only one old inbox invite may change');
    assert.deepEqual(write.changes,{status:'REVOKED'},'status field only');
    docs.set(write.path,{...docs.get(write.path),...write.changes});
    writes.push(write);
   }
   return answer;
  }
 };
 const api=ownerMemberService({db:{},sdk,identity:owner,currentUid:()=>current});
 const args={groupId:GROUP,memberUid:MEMBER,recipientEmail:EMAIL,
  invitationId:old,expectedRole:'EDITOR'};
 return {api,args,docs,writes,pendingPath,memberPath:base+'/members/'+MEMBER,
  setUid:x=>{current=x}};
}
{
 const e=setup();
 const before=structuredClone(e.docs.get(e.memberPath));
 const done=await e.api.revokeRedundantPendingInvite(e.args);
 assert.deepEqual(done,{groupId:GROUP,recipientEmail:EMAIL,status:'REVOKED',memberRole:'EDITOR'});
 assert.equal(e.writes.length,1);
 assert.equal(e.docs.get(e.pendingPath).status,'REVOKED');
 assert.deepEqual(e.docs.get(e.memberPath),before,'existing EDITOR must not change');
 await assert.rejects(()=>e.api.revokeRedundantPendingInvite(e.args),/OLD_PENDING_INVITE_NOT_VERIFIED_STOP/);
 assert.equal(e.writes.length,1);
}
{
 const e=setup();
 await assert.rejects(()=>e.api.revokeRedundantPendingInvite({
  ...e.args,groupId:'anotherBook'}),/ROOT_GROUP_CHANGED_STOP/);
 assert.equal(e.writes.length,0);
}
{
 const e=setup();
 await assert.rejects(()=>e.api.revokeRedundantPendingInvite({
  ...e.args,recipientEmail:'unlinked@example.test'}),/MEMBER_ACCEPTED_EMAIL_LINK_INVALID_STOP/);
 assert.equal(e.writes.length,0);
}
{
 const e=setup();
 e.docs.set(e.memberPath,{...e.docs.get(e.memberPath),status:'REVOKED'});
 await assert.rejects(()=>e.api.revokeRedundantPendingInvite(e.args),/ACTIVE_MEMBER_NOT_VERIFIED_STOP/);
 assert.equal(e.writes.length,0);
}
{
 const e=setup();
 await assert.rejects(()=>e.api.revokeRedundantPendingInvite({
  ...e.args,expectedRole:'VIEWER'}),/ACTIVE_MEMBER_NOT_VERIFIED_STOP/);
 assert.equal(e.writes.length,0);
}
{
 const e=setup();
 e.setUid('otherUid');
 await assert.rejects(()=>e.api.revokeRedundantPendingInvite(e.args),/ACCOUNT_CHANGED/);
 assert.equal(e.writes.length,0);
}
console.log('ROOT_REDUNDANT_PENDING_INVITE_REVOKE_ONE_FIELD_ONLY_SYNTHETIC_PASS');
