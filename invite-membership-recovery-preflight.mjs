import assert from 'node:assert/strict';
import {groupService} from './firebase-group-service.mjs';
// Isolated memory-only Firestore imitation: no network and no real records.
const UID='member_1',EMAIL='member@example.test',GID='book_1',INVITE='invite_1';
const group='groups/'+GID,member=group+'/members/'+UID;
const inbox='inboxes/'+EMAIL+'/invites/'+INVITE,pointer='users/'+UID+'/groupIndex/'+GID;
function setup({failIndexOnce=false,status='PENDING',denyMembershipRead=false}={}){
 const data=new Map([
  [group,{ownerUid:'creator_1',name:'合成共用記事簿',createdAt:1}],
  [inbox,{groupId:GID,recipientEmail:EMAIL,role:'EDITOR',status,invitedBy:'creator_1'}]
 ]);
 let indexAttempts=0;
 const ref=path=>({id:path.split('/').at(-1),path});
 const snap=path=>({id:path.split('/').at(-1),metadata:{fromCache:false},
  exists:()=>data.has(path),data:()=>structuredClone(data.get(path))});
 const sdk={
  collection:(_db,...segments)=>ref(segments.join('/')),
  doc:(base,...parts)=>ref(base?.path?base.path+'/'+parts.join('/'):parts.join('/')),
  getDocs:async ref=>({docs:[...data.keys()].filter(path=>path.startsWith(ref.path+'/')&&
   path.slice(ref.path.length+1).indexOf('/')===-1).map(snap)}),
  getDocsFromServer:async ref=>({metadata:{fromCache:false},
   docs:[...data.keys()].filter(path=>path.startsWith(ref.path+'/')&&
   path.slice(ref.path.length+1).indexOf('/')===-1).map(snap)}),
  getDoc:async ref=>snap(ref.path),
  getDocFromServer:async ref=>{if(denyMembershipRead&&ref.path===member)throw Object.assign(Error('offline'),{code:'unavailable'});return snap(ref.path)},
  setDoc:async(ref,value)=>{
   indexAttempts++;
   if(failIndexOnce&&indexAttempts===1)throw Object.assign(Error('network interruption'),{code:'unavailable'});
   data.set(ref.path,structuredClone(value))
  },
  updateDoc:async()=>{throw Error('unexpected update')},
  writeBatch:()=>{const writes=[];return {
   set:(r,value)=>writes.push([r.path,structuredClone(value)]),
   update:(r,value)=>writes.push([r.path,{...data.get(r.path),...value}]),
   commit:async()=>{for(const [path,value] of writes)data.set(path,value)}
  }},
  Timestamp:{now:()=>({seconds:1234})}
 };
 const api=groupService({db:{},sdk,identity:{uid:UID,email:EMAIL,emailVerified:true}});
 return {api,data,indexAttempts:()=>indexAttempts};
}
{
 const e=setup();
 assert.equal((await e.api.listGroups()).length,0);
 assert.equal((await e.api.listInbox()).length,1);
 const invitation=(await e.api.listInbox())[0];
 const accepted=await e.api.acceptInvite(invitation);
 assert.equal(accepted.indexed,true);
 assert.equal(e.data.get(inbox).status,'ACCEPTED');
 assert.equal(e.data.get(inbox).acceptedUid,UID);
 assert.equal(e.data.get(member).role,'EDITOR');
 assert.equal(e.data.get(pointer).groupId,GID);
 assert.equal((await e.api.listGroups())[0].name,'合成共用記事簿');
 assert.equal((await e.api.acceptInvite(invitation)).alreadyAccepted,true);
 assert.equal(e.indexAttempts(),1,'do not repeat writes for accepted index');
}
{
 const e=setup({failIndexOnce:true});
 const invitation=(await e.api.listInbox())[0];
 const first=await e.api.acceptInvite(invitation);
 assert.equal(first.indexed,false,'index loss must not pretend complete');
 assert.equal(e.data.get(inbox).status,'ACCEPTED');
 assert.equal(e.data.has(pointer),false);
 assert.equal((await e.api.listGroups()).length,0);
 const recovered=await e.api.acceptInvite(invitation);
 assert.equal(recovered.indexed,true);
 assert.equal(recovered.alreadyAccepted,true);
 assert.equal(e.data.get(pointer).groupId,GID);
 assert.equal((await e.api.listGroups()).length,1);
 e.data.set(member,{...e.data.get(member),status:'REVOKED'});
 await assert.rejects(e.api.ensureIndex(GID),/MEMBERSHIP_NOT_ACTIVE/);
 e.data.delete(pointer);
 assert.equal((await e.api.listGroups()).length,0);
}
{
 const e=setup();
 const invitation=(await e.api.listInbox())[0];
 await assert.rejects(e.api.acceptInvite({...invitation,id:'unknown'}),/INVITATION_NOT_FOUND/);
 assert.equal(e.data.has(member),false);
 assert.equal(e.data.has(pointer),false);
}
// Regression: a member already promoted to EDITOR must not accidentally
// lose access when an old VIEWER invite remains in their inbox.
{
 const e=setup();
 e.data.set(member,{uid:UID,role:'EDITOR',status:'ACTIVE',invitationId:'already_joined'});
 e.data.set(inbox,{...e.data.get(inbox),role:'VIEWER'});
 const pending=(await e.api.listInbox())[0];
 assert.equal(await e.api.currentMembershipRole(GID),'EDITOR');
 await assert.rejects(()=>e.api.acceptInvite(pending),/ALREADY_ACTIVE_MEMBER_KEEP_EXISTING_ROLE/);
 assert.equal(e.data.get(member).role,'EDITOR','never replace existing EDITOR with VIEWER');
 assert.equal(e.data.get(inbox).status,'PENDING','do not mutate live old invite');
 assert.equal(e.data.has(pointer),false,'no implied index repair or writes');
 assert.equal(e.indexAttempts(),0,'no unexpected member/index change');
}
// Invalid or unreadable membership state must fail closed, never downgrade.
{
 const e=setup();
 e.data.set(member,{uid:UID,role:'UNKNOWN',status:'ACTIVE',invitationId:'legacy'});
 const pending=(await e.api.listInbox())[0];
 await assert.rejects(()=>e.api.acceptInvite(pending),/MEMBERSHIP_SERVER_STATE_UNEXPECTED_STOP/);
 assert.equal(e.data.get(member).role,'UNKNOWN');
 assert.equal(e.data.get(inbox).status,'PENDING');
 assert.equal(e.data.has(pointer),false);
}
{
 const e=setup();
 e.data.set(member,{uid:UID,role:'ADMIN',status:'ACTIVE',invitationId:'legacy'});
 e.data.set(inbox,{...e.data.get(inbox),role:'VIEWER'});
 const pending=(await e.api.listInbox())[0];
 await assert.rejects(()=>e.api.acceptInvite(pending),/ALREADY_ACTIVE_MEMBER_KEEP_EXISTING_ROLE/);
 assert.equal(e.data.get(member).role,'ADMIN');
 assert.equal(e.data.get(inbox).status,'PENDING');
}
// A failed server read cannot be interpreted as permission to re-accept.
{
 const e=setup({denyMembershipRead:true});
 const pending=(await e.api.listInbox())[0];
 await assert.rejects(()=>e.api.acceptInvite(pending),/offline/);
 assert.equal(e.data.get(inbox).status,'PENDING');
 assert.equal(e.data.has(member),false);
 assert.equal(e.data.has(pointer),false);
}
// A missing current membership can still redeem a valid invitation.
{
 const e=setup();
 assert.equal(await e.api.currentMembershipRole(GID),null);
 const result=await e.api.acceptInvite((await e.api.listInbox())[0]);
 assert.equal(result.indexed,true);
 assert.equal(e.data.get(member).role,'EDITOR');
}
// A revoked former member must not be silently reactivated through a cached
// membership read; the current invitation redemption remains server-controlled.
{
 const e=setup();
 e.data.set(member,{uid:UID,role:'VIEWER',status:'REVOKED',invitationId:'old'});
 assert.equal(await e.api.currentMembershipRole(GID),null);
}
// A verified own directory is strong positive evidence that a delayed
// invitation is stale; another group's PENDING invite cannot borrow that role.
{
 const e=setup();
 e.data.set(member,{uid:UID,role:'EDITOR',status:'ACTIVE',invitationId:'past'});
 e.data.set(pointer,{uid:UID,groupId:GID,createdAt:{seconds:1234}});
 const roles=await e.api.listGroupsFromServer();
 assert.deepEqual(roles.map(x=>({id:x.id,role:x.role})),[{id:GID,role:'EDITOR'}]);
 assert.equal(e.data.get(inbox).status,'PENDING','read-only lookup never mutates pending invite');
}
{
 const e=setup();
 const roles=await e.api.listGroupsFromServer();
 assert.deepEqual(roles,[],'new recipient without existing pointer remains unjoined');
 assert.equal(e.data.get(inbox).status,'PENDING');
}
{
 const e=setup();
 e.data.set(pointer,{uid:UID,groupId:GID,createdAt:{seconds:1234}});
 const roles=await e.api.listGroupsFromServer();
 assert.deepEqual(roles,[],'stale index without ACTIVE member cannot establish membership');
}
console.log('INVITE_MEMBERSHIP_RECOVERY_SYNTHETIC_PASS');
