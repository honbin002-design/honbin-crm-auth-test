// V4C ISOLATED TEST client. Requires owner-approved Firestore Rules V4C
// (NOT deployed), explicit per-notebook owner confirmation and synthetic data.
// This module intentionally never deletes /groups/{id} itself. Firestore
// Security Rules cannot verify dynamically that every descendant is absent.
import {planNotebookHardDelete} from './notebook-hard-delete-plan.mjs';
const ID=/^[A-Za-z0-9_-]{1,180}$/;
const validId=s=>typeof s==='string'&&ID.test(s);
const error=code=>{throw Error(code)};
const ensureServer=snapshot=>{
 if(!snapshot||snapshot.metadata?.fromCache===true)error('CACHED_READBACK_NOT_ACCEPTABLE');
 return snapshot;
};
export function notebookHardDeleteV4C({db,sdk,actor}={}){
 if(!db||!sdk||!actor||!validId(actor.uid)||typeof actor.currentUid!=='function'
   ||actor.emailVerified!==true||actor.providerId!=='google.com')
   error('VERIFIED_GOOGLE_OWNER_REQUIRED');
 const required=['doc','collection','getDocFromServer','getDocsFromServer',
  'updateDoc','deleteDoc','writeBatch','runTransaction','Timestamp'];
 for(const key of required)if(!sdk[key])error('SDK_MISSING_'+key);
 const uid=actor.uid;
 const guard=()=>{if(actor.currentUid()!==uid)error('DELETION_GOOGLE_ACCOUNT_CHANGED')};
 const ref=gid=>{if(!validId(gid))error('INVALID_NOTEBOOK_ID');return sdk.doc(db,'groups',gid)};
 const pathRef=p=>sdk.doc(db,p);
 const groupChildren=(gid,child)=>sdk.collection(db,'groups',gid,child);
 const readGroup=async gid=>{
  guard();const snap=ensureServer(await sdk.getDocFromServer(ref(gid)));guard();
  if(!snap.exists())error('NOTEBOOK_NOT_FOUND');
  if(snap.data().ownerUid!==uid)error('NOTEBOOK_CREATOR_REQUIRED');
  return {id:gid,...snap.data()};
 };
 const serverList=async(groupId,kind)=>{
  guard();const snap=ensureServer(await sdk.getDocsFromServer(groupChildren(groupId,kind)));
  guard();return snap.docs.map(d=>({id:d.id,...d.data()}));
 };
 async function preview(groupId){
  const group=await readGroup(groupId);
  if(group.deleteState)error('NOTEBOOK_ALREADY_LOCKED');
  const [notes,members,sentInvites]=await Promise.all([
   serverList(groupId,'notes'),serverList(groupId,'members'),serverList(groupId,'sentInvites')]);
  guard();
  return Object.freeze({groupId,name:group.name,
   noteCount:notes.length,memberCount:members.length,invitationCount:sentInvites.length,
   requiresTypedName:true,irreversible:true});
 }
 async function lock(groupId,{typedName,deletionId}={}){
  if(!validId(deletionId)||deletionId.length<16)error('INVALID_DELETE_EPOCH');
  const group=await readGroup(groupId);
  if(!typedName||typedName!==group.name)error('NOTEBOOK_NAME_CONFIRMATION_REQUIRED');
  guard();
  await sdk.runTransaction(db,async tx=>{
   guard();const snap=await tx.get(ref(groupId));guard();
   if(!snap.exists()||snap.data().ownerUid!==uid)error('NOTEBOOK_CREATOR_REQUIRED');
   if(snap.data().deleteState)error('NOTEBOOK_ALREADY_LOCKED');
   if(snap.data().name!==typedName)error('NOTEBOOK_NAME_CHANGED');
   tx.update(ref(groupId),{deleteState:'DELETING',deletionId,
    deletingAt:sdk.Timestamp.now()});
  });
  const fresh=await readGroup(groupId);
  if(fresh.deleteState!=='DELETING'||fresh.deletionId!==deletionId)
   error('DELETION_LOCK_READBACK_FAILED');
  return Object.freeze({groupId,deletionId,stage:'LOCKED',rootPhysicalDeletion:false});
 }
 async function inventory(groupId,deletionId){
  const group=await readGroup(groupId);
  if(group.deleteState!=='DELETING'||group.deletionId!==deletionId)
   error('DELETE_EPOCH_MISMATCH');
  const [notes,members,sentInvites]=await Promise.all([
   serverList(groupId,'notes'),serverList(groupId,'members'),serverList(groupId,'sentInvites')]);
  guard();
  const manifest=planNotebookHardDelete({
   actorUid:uid,group:{...group,deleteState:'DELETING'},deletionId,
   inventory:{
    notes:{complete:true,items:notes.map(x=>({id:x.id,groupId:x.groupId}))},
    members:{complete:true,items:members.map(x=>({uid:x.uid}))},
    sentInvites:{complete:true,items:sentInvites.map(x=>({
     id:x.id,groupId:x.groupId,recipientEmail:x.recipientEmail}))}
   }
  });
  return Object.freeze({group,notes,members,sentInvites,manifest});
 }
 async function batchDelete(paths){
  guard();
  if(paths.length<1||paths.length>10)error('UNSAFE_BATCH_LENGTH');
  const batch=sdk.writeBatch(db);
  for(const p of paths)batch.delete(pathRef(p));
  await batch.commit();guard();
 }
 async function runCleanup(groupId,deletionId,{onProgress}={}){
  // Explicit caller action only; never run automatically on page load.
  // Fresh server inventory on every retry. V4C Rules enforce atomic pairs.
  if(!validId(deletionId)||deletionId.length<16)error('INVALID_DELETE_EPOCH');
  const report=(stage,processed,total)=>{
   if(typeof onProgress==='function'){
    try{onProgress(Object.freeze({stage,processed,total,
      rootPhysicalDeletion:false}));}catch{ /* UI callback cannot affect deletes */ }
   }
  };
  let state=await inventory(groupId,deletionId);
  report('NOTES',0,state.notes.length);
  for(let i=0;i<state.notes.length;i+=10){
   await batchDelete(state.notes.slice(i,i+10).map(n=>'groups/'+groupId+'/notes/'+n.id));
   report('NOTES',Math.min(i+10,state.notes.length),state.notes.length);
  }
  // Each pair is one Firestore atomic batch: ACK loss cannot separate them.
  report('INVITES',0,state.sentInvites.length);
  for(const [i,inv] of state.sentInvites.entries()){
   await batchDelete([
    'inboxes/'+inv.recipientEmail+'/invites/'+inv.id,
    'groups/'+groupId+'/sentInvites/'+inv.id
   ]);
   report('INVITES',i+1,state.sentInvites.length);
  }
  report('MEMBERS',0,state.members.length);
  for(const [i,m] of state.members.entries()){
   // Some members may never have completed ensureIndex. Their member
   // document still must be deleted, without fabricating pointer evidence.
   guard();
   const pointer='users/'+m.uid+'/groupIndex/'+groupId;
   const exact=ensureServer(await sdk.getDocFromServer(pathRef(pointer)));
   guard();
   const paths=exact.exists()?[pointer,'groups/'+groupId+'/members/'+m.uid]:
    ['groups/'+groupId+'/members/'+m.uid];
   await batchDelete(paths);
   report('MEMBERS',i+1,state.members.length);
  }
  report('VERIFY',0,1);
  // Keep the owner's discovery pointer until a separately trusted final
  // purge can remove the root. Otherwise an interrupted Safari session can
  // lose the ONLY way to find a DELETING group and resume cleanup.
  // The pointer contains no note text; active notebook lists must hide it.
  const own='users/'+uid+'/groupIndex/'+groupId;
  state=await inventory(groupId,deletionId);
  const pointer=ensureServer(await sdk.getDocFromServer(pathRef(own)));
  guard();
  if(state.notes.length||state.members.length||state.sentInvites.length)
   error('DELETE_CLEANUP_NOT_YET_COMPLETE');
  report('VERIFY',1,1);
  // The root stays permanently locked: ordinary members have zero access
  // and cannot resurrect notes. Final root removal requires a trusted,
  // separately approved server-side verification protocol.
  return Object.freeze({groupId,deletionId,stage:'CONTENT_CLEANED_ROOT_LOCKED',
   notesRemaining:0,membersRemaining:0,sentInvitesRemaining:0,
   ownerPointerRetained:pointer.exists(),rootPhysicalDeletion:false,rootDeletionAuthorized:false,
   // UI may hide this from ACTIVE notebooks but must keep a resume/history entry.
   activeNotebook:false});
 }
 // FINAL MANUAL STEP for V4D ONLY: Firebase Console (owner/admin UI)
 // physically deletes the root AFTER the user confirms content cleanup.
 // Firestore Rules MUST never grant general client root-delete privileges.
 // This function can only verify that the root is truly absent and remove
 // the current owner's now-orphaned index; no Admin token is handled here.
 async function confirmConsoleRootRemoved(groupId,{cleanupReceipt,typedPhrase}={}){
  guard();
  if(!validId(groupId))error('INVALID_NOTEBOOK_ID');
  if(typedPhrase!=='我已刪除記事簿主文件')
   error('EXPLICIT_CONSOLE_DELETE_CONFIRMATION_REQUIRED');
  if(!cleanupReceipt || cleanupReceipt.groupId!==groupId
      || !validId(cleanupReceipt.deletionId)
      || cleanupReceipt.stage!=='CONTENT_CLEANED_ROOT_LOCKED'
      || cleanupReceipt.notesRemaining!==0
      || cleanupReceipt.membersRemaining!==0
      || cleanupReceipt.sentInvitesRemaining!==0
      || cleanupReceipt.rootPhysicalDeletion!==false
      || cleanupReceipt.rootDeletionAuthorized!==false)
   error('CLEANUP_RECEIPT_REQUIRED');
  const root=ensureServer(await sdk.getDocFromServer(ref(groupId)));guard();
  if(root.exists())error('FIREBASE_ROOT_DOCUMENT_STILL_EXISTS');
  const indexRef=pathRef('users/'+uid+'/groupIndex/'+groupId);
  const own=ensureServer(await sdk.getDocFromServer(indexRef));guard();
  if(own.exists() && (own.data().uid!==uid || own.data().groupId!==groupId))
   error('STALE_INDEX_OWNER_SCOPE_MISMATCH');
  // Double-check root while the pointer still exists. V4D grants read of
  // absent group ONLY while the caller still has their own stale index.
  const rootDoubleCheck=ensureServer(await sdk.getDocFromServer(ref(groupId)));
  guard();if(rootDoubleCheck.exists())error('FIREBASE_ROOT_DOCUMENT_REAPPEARED');
  if(own.exists()){
   await sdk.deleteDoc(indexRef);guard();
  }
  const finalIndex=ensureServer(await sdk.getDocFromServer(indexRef));guard();
  if(finalIndex.exists())error('OWNER_STALE_INDEX_REMAINED');
  return Object.freeze({
   groupId,deletionId:cleanupReceipt.deletionId,
   stage:'ROOT_PHYSICALLY_REMOVED_AND_OWNER_INDEX_CLEARED',
   rootPhysicallyDeleted:true,ownerIndexCleared:true,
   verification:'TWO_FIRESTORE_SERVER_READS_BEFORE_POINTER_REMOVAL',
   // Console may have been used incorrectly or independently; this is
   // NOT an admin audit of every unknown collection and retained device.
   allChildCollectionsIndependentlyAudited:false
  });
 }
 // Recovery for a Safari tab reloaded AFTER the owner already used the
 // privileged Firebase Console to remove the root. The prior in-memory
 // receipt is then unavailable: do NOT claim to have independently audited
 // old child collections. Only clean the caller's own orphaned pointer.
 async function removeOwnOrphanedPointer(groupId,{typedPhrase}={}){
  guard();
  if(!validId(groupId))error('INVALID_NOTEBOOK_ID');
  if(typedPhrase!=='只清除我的失效索引')
   error('ORPHAN_INDEX_CONFIRMATION_REQUIRED');
  const root=ensureServer(await sdk.getDocFromServer(ref(groupId)));guard();
  if(root.exists())error('NOTEBOOK_ROOT_STILL_PRESENT');
  const ownPath='users/'+uid+'/groupIndex/'+groupId,indexRef=pathRef(ownPath);
  const old=ensureServer(await sdk.getDocFromServer(indexRef));guard();
  if(old.exists()){
   if(old.data().uid!==uid||old.data().groupId!==groupId)
    error('STALE_INDEX_OWNER_SCOPE_MISMATCH');
   await sdk.deleteDoc(indexRef);guard();
  }
  const check=ensureServer(await sdk.getDocFromServer(indexRef));guard();
  if(check.exists())error('OWNER_STALE_INDEX_REMAINED');
  return Object.freeze({groupId,rootPhysicallyDeleted:true,
   ownerIndexCleared:true,cleanupReceiptPresent:false,
   allChildCollectionsIndependentlyAudited:false,
   stage:'ROOT_MISSING_OWN_INDEX_CLEARED_NO_CLEANUP_RECEIPT'});
 }
 return Object.freeze({preview,lock,inventory,runCleanup,
   confirmConsoleRootRemoved,removeOwnOrphanedPointer});
}
