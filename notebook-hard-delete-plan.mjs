// SAFE DRY-RUN manifest for a future owner-approved hard-delete protocol.
// This module is PURE: no Firestore SDK, OAuth, network or mutations.
// A manifest is NOT permission to execute; server rules and live readback are
// mandatory. Do not use an archival toggle as a substitute for hard deletion.
const segment=s=>typeof s==='string'&&s.length>0&&s.length<=180&&/^[A-Za-z0-9_-]+$/.test(s);
const email=s=>typeof s==='string'&&s.length<=254&&/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(s)&&s===s.toLowerCase();
function reject(code){throw Error(code)}
function recordList(value,code){
 if(!value||value.complete!==true||!Array.isArray(value.items))reject(code);
 return value.items;
}
function op(id,path,kind){return Object.freeze({id,path,kind})}
export function planNotebookHardDelete({actorUid,group,deletionId,inventory}={}){
 if(!segment(actorUid)||!group||!segment(group.id)||!segment(group.ownerUid)||!segment(deletionId))
  reject('INVALID_DELETE_IDENTITY');
 if(actorUid!==group.ownerUid)reject('DELETE_OWNER_REQUIRED');
 if(group.deleteState!=='DELETING'||group.deletionId!==deletionId)
  reject('GROUP_NOT_LOCKED_FOR_THIS_DELETION');
 if(!inventory)reject('DELETE_INVENTORY_REQUIRED');
 const gid=group.id,base='groups/'+gid;
 const notes=recordList(inventory.notes,'NOTES_SCAN_INCOMPLETE');
 const members=recordList(inventory.members,'MEMBERS_SCAN_INCOMPLETE');
 const invites=recordList(inventory.sentInvites,'SENT_INVITES_SCAN_INCOMPLETE');
 const unique=new Set(),noteOps=[],memberOps=[],inviteOps=[],indexOps=[],inboxOps=[];
 const put=(to,path,kind)=>{
  if(unique.has(path))reject('DUPLICATE_DELETE_PATH');
  // Stable idempotency identity MUST NOT depend on snapshot page order.
  unique.add(path);to.push(op(deletionId+':'+path,path,kind));
 };
 for(const item of notes){
  if(!item||!segment(item.id)||item.groupId!==gid)reject('INVALID_NOTE_SCOPE');
  put(noteOps,base+'/notes/'+item.id,'shared-note');
 }
 for(const item of members){
  if(!item||!segment(item.uid))reject('INVALID_MEMBER_UID');
  put(memberOps,base+'/members/'+item.uid,'member');
 }
 for(const item of invites){
  if(!item||!segment(item.id)||item.groupId!==gid||!email(item.recipientEmail))
   reject('INVALID_INVITE_SCOPE');
  put(inviteOps,base+'/sentInvites/'+item.id,'sent-invite');
  put(inboxOps,'inboxes/'+item.recipientEmail+'/invites/'+item.id,'recipient-invite');
 }
 // A revoked member may keep an index. The creator's OWN pointer
 // must survive content cleanup: otherwise reopening Safari cannot find
 // the locked root to resume. A separate finalizer removes it last.
 const uids=new Set(members.map(x=>x.uid).filter(uid=>uid!==actorUid));
 for(const uid of [...uids].sort())put(indexOps,'users/'+uid+'/groupIndex/'+gid,'group-pointer');
 const operations=[...notesSorted(noteOps),...notesSorted(inboxOps),...notesSorted(inviteOps),
  ...notesSorted(indexOps),...notesSorted(memberOps)];
 return Object.freeze({
  groupId:gid,ownerUid:actorUid,deletionId,
  stage:'CLEAN_CHILDREN_AND_EXTERNAL_REFERENCES_ONLY',
  operations:Object.freeze(operations),
  counts:Object.freeze({notes:noteOps.length,members:memberOps.length,
   sentInvites:inviteOps.length,inboxInvites:inboxOps.length,indexPointers:indexOps.length}),
  // A root deletion cannot be included in an inventory-phase manifest:
  // if deleted early, leftover child paths become orphaned.
  rootPath:base,
   retainedOwnerPointerPath:'users/'+actorUid+'/groupIndex/'+gid,
   rootDeletionAuthorized:false
 });
}
function notesSorted(arr){return [...arr].sort((a,b)=>a.path.localeCompare(b.path))}
export function qualifyFinalHardDelete({manifest,readback,actorUid,deletionId}={}){
 if(!manifest||!segment(actorUid)||!segment(deletionId)||
    actorUid!==manifest.ownerUid||deletionId!==manifest.deletionId)
   reject('DELETE_RESUME_IDENTITY_MISMATCH');
 if(!readback||readback.sameDeletionId!==true||
    readback.groupState!=='DELETING'||readback.fromServer!==true||
    readback.notesComplete!==true||readback.membersComplete!==true||
    readback.sentInvitesComplete!==true||readback.externalReferencesChecked!==true)
   reject('FINAL_DELETE_PROOF_INCOMPLETE');
 const fields=['notesRemaining','membersRemaining','sentInvitesRemaining',
 'inboxInvitesRemaining','indexPointersRemaining'];
 for(const f of fields){
  if(!Number.isSafeInteger(readback[f])||readback[f]!==0)reject('ORPHAN_RECORDS_REMAIN');
 }
 // This is an application-side eligibility result, NOT server authorization.
 // A future backend/Rules gate must independently validate root-finality.
 return Object.freeze({eligible:true,rootPath:manifest.rootPath,deletionId,
  warning:'CLIENT_READBACK_IS_NOT_A_SERVER_ENFORCEABLE_PROOF'});
}
export function limitDeleteBatch(operations,maxPerBatch=10){
 if(!Array.isArray(operations)||!Number.isSafeInteger(maxPerBatch)||
    maxPerBatch<1||maxPerBatch>10)reject('UNSAFE_DELETE_BATCH_SIZE');
 const groups=[];
 for(let i=0;i<operations.length;i+=maxPerBatch)
  groups.push(Object.freeze(operations.slice(i,i+maxPerBatch)));
 return Object.freeze(groups);
}
