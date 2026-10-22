import assert from 'node:assert/strict';
import {groupService} from './firebase-group-service.mjs';
// All operations are in-memory mocks. No network, Firebase credentials or data.
const original={ownerUid:'owner_1',name:'團隊筆記',createdAt:1};
function harness(actor='owner_1'){
 const database=new Map([
  ['groups/g1',{...original}],
  ['users/'+actor+'/groupIndex/g1',{uid:actor,groupId:'g1',createdAt:1}]
 ]);
 let writes=0,id=0;
 const lookup=path=>database.get(path);
 const ref=(kind,path)=>({kind,path,id:path.split('/').at(-1)});
 const audit=[];
 const sdk={
  collection:(_db,...pieces)=>ref('collection',pieces.join('/')),
  doc:(base,...pieces)=>{
   if(base?.kind==='collection')return ref('doc',base.path+'/new_'+(++id));
   return ref('doc',pieces.join('/'));
  },
  getDocs:async r=>({docs:[...database.keys()].filter(x=>x.startsWith(r.path+'/')&&x.split('/').length===r.path.split('/').length+1)
    .map(p=>({id:p.split('/').at(-1),data:()=>({...lookup(p)})}))}),
  getDocsFromServer:async r=>{
   const docs=[...database.keys()].filter(x=>x.startsWith(r.path+'/')&&
    x.split('/').length===r.path.split('/').length+1)
    .map(p=>({id:p.split('/').at(-1),data:()=>({...lookup(p)})}));
   return {metadata:{fromCache:false},size:docs.length,docs};
  },
  getDoc:async r=>({exists:()=>database.has(r.path),data:()=>({...lookup(r.path)})}),
  getDocFromServer:async r=>({metadata:{fromCache:false},exists:()=>database.has(r.path),data:()=>({...lookup(r.path)})}),
  setDoc:async()=>{},updateDoc:async(r,change)=>{
   writes++;audit.push({path:r.path,change});
   database.set(r.path,{...lookup(r.path),...change});
  },
  writeBatch:()=>{const ops=[];return {
   set:(r,data)=>ops.push([r.path,data]),commit:async()=>{for(const [path,data] of ops)database.set(path,data)}
  }},
  Timestamp:{now:()=>({seconds:123})}
 };
 const service=groupService({db:{},sdk,identity:{uid:actor,email:'owner@example.com',emailVerified:true}});
 return {service,database,audit,getWrites:()=>writes};
}
const own=harness();
const before=await own.service.listGroups();
assert.equal(before.length,1);
assert.equal(before[0].ownerUid,'owner_1');
await assert.rejects(own.service.retireNotebook('g1','錯誤名稱'),/NOTEBOOK_NAME_CHANGED/);
assert.equal(own.getWrites(),0);
const locked=await own.service.retireNotebook('g1','團隊筆記');
assert.equal(locked.locked,true);
assert.equal(locked.rootDeleted,false);
assert.equal(locked.contentDeleted,false);
assert.equal(own.getWrites(),1);
assert.equal(own.database.get('groups/g1').deleteState,'DELETING');
assert.deepEqual(await own.service.listGroups(),[]);
await assert.rejects(own.service.retireNotebook('g1','團隊筆記'),/NOTEBOOK_ALREADY_RETIRED/);
const other=harness('other_1');
await assert.rejects(other.service.retireNotebook('g1','團隊筆記'),/NOTEBOOK_CREATOR_REQUIRED/);
assert.equal(other.getWrites(),0);
const newGroup=await other.service.createGroup('新記事簿');
assert.equal(newGroup.ownerUid,'other_1');
assert.equal(other.database.get('groups/'+newGroup.id).name,'新記事簿');
// Future notebook deletion must revoke PENDING invitations before locking,
// while preserving ACCEPTED history and group membership.
const withInvites=harness();
withInvites.database.set('groups/g1/sentInvites/inv_1',{
 groupId:'g1',recipientEmail:'one@example.com',role:'VIEWER'});
withInvites.database.set('inboxes/one@example.com/invites/inv_1',{
 groupId:'g1',recipientEmail:'one@example.com',role:'VIEWER',status:'PENDING'});
withInvites.database.set('groups/g1/sentInvites/inv_2',{
 groupId:'g1',recipientEmail:'two@example.com',role:'EDITOR'});
withInvites.database.set('inboxes/two@example.com/invites/inv_2',{
 groupId:'g1',recipientEmail:'two@example.com',role:'EDITOR',status:'ACCEPTED'});
const outcome=await withInvites.service.retireNotebook('g1','團隊筆記');
assert.equal(outcome.revokedPendingInvites,1);
assert.equal(withInvites.database.get('inboxes/one@example.com/invites/inv_1').status,'REVOKED');
assert.equal(withInvites.database.get('inboxes/two@example.com/invites/inv_2').status,'ACCEPTED');
assert.deepEqual(withInvites.audit.map(x=>x.path),[
 'inboxes/one@example.com/invites/inv_1','groups/g1'
],'pending cancellation happens before group lock; accepted not rewritten');
assert.deepEqual(withInvites.audit[0].change,{status:'REVOKED'});
assert.equal(outcome.locked,true);
// A malformed sent invite prevents any lock or writes.
const invalid=harness();
invalid.database.set('groups/g1/sentInvites/inv_bad',{
 groupId:'other',recipientEmail:'three@example.com',role:'VIEWER'});
await assert.rejects(invalid.service.retireNotebook('g1','團隊筆記'),
 /RETIRE_SENT_INVITE_INTEGRITY_STOP/);
assert.equal(invalid.getWrites(),0);
assert.equal(invalid.database.get('groups/g1').deleteState,undefined);
console.log('NOTEBOOK_RETIRE_PENDING_INVITE_REVOKE_BEFORE_LOCK_PASS');
console.log('NOTEBOOK_LIFECYCLE_SYNTHETIC_PASS',8);
