import assert from 'node:assert/strict';
import {ownerMemberService} from './firebase-owner-member-service.mjs';
// All data below is synthetic, in-memory only. No Firebase network, no real accounts.
const group='groups/g1',sent=group+'/sentInvites/inv1';
const inbox='inboxes/invited@example.test/invites/inv1';
const account='approvedAccounts/invited@example.test';
function mock(){
 const db=new Map([
  [group,{ownerUid:'root123',name:'合成記事簿',createdAt:1}],
  [sent,{groupId:'g1',recipientEmail:'invited@example.test',role:'EDITOR',invitedBy:'root123'}],
  [inbox,{groupId:'g1',recipientEmail:'invited@example.test',role:'EDITOR',status:'PENDING',invitedBy:'root123'}]
 ]);
 const calls=[];
 const sdk={
  doc:(_db,...parts)=>({path:parts.join('/')}),
  collection:()=>({}),
  getDocs:async()=>({docs:[]}),
  getDocFromServer:async ref=>({exists:()=>db.has(ref.path),data:()=>({...db.get(ref.path)})}),
  runTransaction:async()=>{},
  serverTimestamp:()=>({serverTime:true}),
  setDoc:async(ref,data)=>{calls.push(['set',ref.path,{...data}]);db.set(ref.path,data)},
  updateDoc:async(ref,data)=>{calls.push(['update',ref.path,{...data}]);db.set(ref.path,{...db.get(ref.path),...data})}
 };
 const service=ownerMemberService({db:{},sdk,
  identity:{uid:'root123',email:'honbin002@gmail.com',emailVerified:true,providerId:'google.com'},
  currentUid:()=> 'root123'});
 return {db,calls,service};
}
const args={groupId:'g1',invitationId:'inv1',recipientEmail:'invited@example.test'};
const m=mock();
assert.equal((await m.service.accountApprovalStatus(args)).status,'NOT_APPROVED');
assert.equal(m.calls.length,0,'Read status must not write');
let result=await m.service.approveInvitedAccount(args);
assert.equal(result.status,'ACTIVE');
assert.equal(m.db.get(account).email,'invited@example.test');
assert.equal(m.db.get(account).status,'ACTIVE');
assert.equal(m.calls.length,1);
assert.equal(m.calls[0][0],'set');
assert.equal(m.db.get(inbox).status,'PENDING','Approve only login, not invite');
result=await m.service.approveInvitedAccount(args);
assert.equal(result.alreadyActive,true);
assert.equal(m.calls.length,1,'Repeat approval must be idempotent');
m.db.set(account,{email:'invited@example.test',status:'REVOKED',createdAt:{old:true}});
result=await m.service.approveInvitedAccount(args);
assert.equal(result.status,'ACTIVE');
assert.equal(m.calls[1][0],'update');
assert.deepEqual(m.db.get(account).createdAt,{old:true},'Reactivate only status');
const writes=m.calls.length;
for(const invalid of [
 {...args,recipientEmail:'other@example.test'},
 {...args,recipientEmail:'invalid'},
 {...args,invitationId:'missing'},
 {...args,groupId:'unknown'}
])await assert.rejects(m.service.approveInvitedAccount(invalid));
assert.equal(m.calls.length,writes,'Reject unrelated/invented account authorization');
m.db.set(inbox,{...m.db.get(inbox),status:'REVOKED'});
await assert.rejects(m.service.approveInvitedAccount(args),/INVITATION_NOT_ELIGIBLE/);
assert.equal(m.calls.length,writes);
m.db.set(inbox,{...m.db.get(inbox),status:'PENDING'});
m.db.set(group,{...m.db.get(group),ownerUid:'not-root'});
await assert.rejects(m.service.approveInvitedAccount(args),/OWNER_GROUP_REQUIRED/);
assert.equal(m.calls.length,writes);
assert.throws(()=>ownerMemberService({db:{},sdk:{},identity:
 {uid:'root123',email:'intruder@example.test',emailVerified:true,providerId:'google.com'},
 currentUid:()=> 'root123'}),/VERIFIED_ROOT_OWNER_REQUIRED/);
console.log('INVITED_ACCOUNT_APPROVAL_SYNTHETIC_PASS',23);
