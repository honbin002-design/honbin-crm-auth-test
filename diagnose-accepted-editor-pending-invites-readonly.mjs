// One-time private, bounded, READ-ONLY diagnostic of unexpected PENDING
// inbox invitations for already-accepted members of owner's "鴻繽" notebook.
// No emails/UIDs/group IDs/endpoints printed; no writes and no notifications.
const PROJECT='honbin-crm-notes-spark';
const OWNER='honbin002@gmail.com';
const SERVICE='honbin-test-push-sender@'+PROJECT+'.iam.gserviceaccount.com';
function stop(code){throw Error('INVITATION_READONLY_SAFE_HOLD_'+code)}
let credentials;
try{credentials=JSON.parse(process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON||'')}
catch{stop('MISSING_OR_INVALID_CREDENTIAL')}
if(credentials.type!=='service_account'||credentials.project_id!==PROJECT||
 credentials.client_email!==SERVICE||
 !String(credentials.private_key||'').includes('-----BEGIN PRIVATE KEY-----'))
 stop('DEDICATED_IDENTITY_REQUIRED');
const [{initializeApp,cert,deleteApp},{getAuth},{getFirestore}]=await Promise.all([
 import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/firestore')]);
const app=initializeApp({credential:cert(credentials),projectId:PROJECT});
try{
 const auth=getAuth(app),db=getFirestore(app),owner=await auth.getUserByEmail(OWNER);
 if(!owner?.emailVerified||!owner.providerData.some(x=>x.providerId==='google.com'))
  stop('OWNER_NOT_VERIFIED');
 const pointers=await db.collection('users').doc(owner.uid).collection('groupIndex').limit(11).get();
 if(pointers.size>10)stop('OWNER_GROUP_LIMIT_EXCEEDED');
 const counts={notebooks:0,activeEditors:0,activeOtherRoles:0,
  membersWithPending:0,pendingSameNotebook:0,pendingOtherNotebook:0,
  pendingMissingNotebook:0,pendingRetiredNotebook:0,
  pendingOtherNotebookActiveMember:0,pendingOtherNotebookNotMember:0,
  pendingSentIndexMissing:0,pendingNotVerifiedEmail:0};
 const verified=new Set();
 for(const ptr of pointers.docs){
  const group=await db.collection('groups').doc(ptr.id).get();
  if(!group.exists||group.data().name!=='鴻繽'||group.data().ownerUid!==owner.uid)continue;
  counts.notebooks++;
  const members=await group.ref.collection('members').limit(13).get();
  if(members.size>12)stop('MEMBER_LIMIT_EXCEEDED');
  for(const member of members.docs){
   const data=member.data();
   if(data.uid!==member.id||data.status!=='ACTIVE'||member.id===owner.uid)continue;
   if(data.role==='EDITOR')counts.activeEditors++;
   else counts.activeOtherRoles++;
   if(verified.has(member.id))continue;
   verified.add(member.id);
   const identity=await auth.getUser(member.id);
   if(!identity?.emailVerified||!identity.email||
      !identity.providerData.some(p=>p.providerId==='google.com')){
    counts.pendingNotVerifiedEmail++;continue;
   }
   const pending=await db.collection('inboxes').doc(identity.email.toLowerCase())
    .collection('invites').limit(31).get();
   if(pending.size>30)stop('INBOX_LIMIT_EXCEEDED');
   let hasPending=false;
   for(const invitation of pending.docs){
    const data=invitation.data();
    if(data.status!=='PENDING')continue;
    hasPending=true;
    if(data.recipientEmail!==identity.email.toLowerCase()||
       typeof data.groupId!=='string'||!data.groupId)stop('INBOX_INTEGRITY_FAILURE');
    const target=await db.collection('groups').doc(data.groupId).get();
    if(!target.exists){counts.pendingMissingNotebook++;continue}
    if(target.data().deleteState){counts.pendingRetiredNotebook++;continue}
    if(target.id===group.id)counts.pendingSameNotebook++;
    else counts.pendingOtherNotebook++;
    const sent=await target.ref.collection('sentInvites').doc(invitation.id).get();
    if(!sent.exists||sent.data().groupId!==target.id||
       sent.data().recipientEmail!==identity.email.toLowerCase())
      counts.pendingSentIndexMissing++;
    if(target.id!==group.id){
     const targetMember=await target.ref.collection('members').doc(member.id).get();
     if(targetMember.exists&&targetMember.data().status==='ACTIVE'&&
        targetMember.data().uid===member.id)
      counts.pendingOtherNotebookActiveMember++;
     else counts.pendingOtherNotebookNotMember++;
    }
   }
   if(hasPending)counts.membersWithPending++;
  }
 }
 // Public GitHub logs contain ONLY aggregated counts; never personal records.
 for(const [key,value] of Object.entries(counts))
  console.log('INVITE_AUDIT_'+key.toUpperCase()+'_'+value);
 if(counts.notebooks!==1)console.log('INVITE_AUDIT_NOTEBOOK_COUNT_UNEXPECTED_SAFE_HOLD');
 else if(counts.pendingSameNotebook)console.log('INVITE_AUDIT_SAME_NOTEBOOK_STALE_PENDING_PROVEN');
 else if(counts.pendingOtherNotebook||counts.pendingMissingNotebook||counts.pendingRetiredNotebook)
  console.log('INVITE_AUDIT_NO_SAME_NOTEBOOK_PENDING_CHECK_OTHER_INVITES');
 else console.log('INVITE_AUDIT_NO_PENDING_INBOX_FOR_ACTIVE_MEMBERS');
 console.log('INVITE_AUDIT_READ_ONLY_NO_RECORDS_MODIFIED');
}catch(error){
 console.error('INVITE_AUDIT_HOLD_'+(error?.code==='permission-denied'?'PERMISSION_DENIED':
  String(error?.message||'ERROR').startsWith('INVITATION_READONLY_SAFE_HOLD_')?
   String(error.message).replace('INVITATION_READONLY_SAFE_HOLD_',''):'SERVER_READ_FAILURE'));
 process.exitCode=1;
}finally{await deleteApp(app)}
