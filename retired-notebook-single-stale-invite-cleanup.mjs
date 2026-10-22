// Single-use, tightly scoped cleanup of ONE PENDING VIEWER invitation that
// belongs to a group already RETIRED by the same CRM root owner.
// PRESERVES inbox document as REVOKED; never deletes anything, never changes
// any membership, never touches notes/tasks, no account identifiers in logs.
// No automatic scanning schedule: invoked by one disposable workflow only.
const PROJECT='honbin-crm-notes-spark';
const OWNER='honbin002@gmail.com';
const EXPECTED_IDENTITY='honbin-test-push-sender@'+PROJECT+'.iam.gserviceaccount.com';
const stopped=reason=>{throw Error('RETIRED_INVITE_SAFE_HOLD_'+reason)};
if(process.env.RETIRED_INVITE_SINGLE_CLEANUP_APPROVED!=='yes')stopped('EXPLICIT_APPROVAL_REQUIRED');
let key;
try{key=JSON.parse(process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON||'')}
catch{stopped('CREDENTIAL_UNAVAILABLE')}
if(key.type!=='service_account'||key.project_id!==PROJECT||
  key.client_email!==EXPECTED_IDENTITY||!key.private_key?.includes('-----BEGIN PRIVATE KEY-----'))
 stopped('DEDICATED_IDENTITY_REQUIRED');
const [{initializeApp,cert,deleteApp},{getAuth},{getFirestore}]=await Promise.all([
 import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/firestore')]);
const app=initializeApp({projectId:PROJECT,credential:cert(key)});
try{
 const db=getFirestore(app),auth=getAuth(app),root=await auth.getUserByEmail(OWNER);
 if(!root?.uid||!root.emailVerified||!root.providerData?.some(x=>x.providerId==='google.com'))
  stopped('ROOT_OWNER_IDENTITY_UNVERIFIED');
 // Root's live notebook must be the only "鴻繽", with exactly 3 ACTIVE EDITORs.
 const pointers=await db.collection('users').doc(root.uid).collection('groupIndex').limit(11).get();
 if(pointers.size>10)stopped('TOO_MANY_OWNER_GROUPS');
 const matches=[];
 for(const pointer of pointers.docs){
  const gr=await db.collection('groups').doc(pointer.id).get();
  if(gr.exists&&gr.data()?.name==='鴻繽'&&gr.data()?.ownerUid===root.uid&&!gr.data()?.deleteState)
   matches.push(gr);
 }
 if(matches.length!==1)stopped('ACTIVE_PRIMARY_NOTEBOOK_NOT_UNIQUE');
 const primary=matches[0];
 const members=await primary.ref.collection('members').limit(13).get();
 if(members.size>12)stopped('TOO_MANY_PRIMARY_MEMBERS');
 const activeEditors=members.docs.filter(x=>x.data()?.status==='ACTIVE'&&
  x.data()?.role==='EDITOR'&&x.data()?.uid===x.id);
 if(activeEditors.length!==3)stopped('PRIMARY_EDITORS_NOT_EXACTLY_THREE');
 const oldInvites=[];
 for(const editor of activeEditors){
  const person=await auth.getUser(editor.id);
  if(!person?.emailVerified||!person.email||
   !person.providerData?.some(p=>p.providerId==='google.com'))
   stopped('EDITOR_IDENTITY_UNVERIFIED');
  const mail=person.email.toLowerCase();
  const received=await db.collection('inboxes').doc(mail).collection('invites').limit(31).get();
  if(received.size>30)stopped('TOO_MANY_INBOX_RECORDS');
  for(const inv of received.docs){
   const data=inv.data();
   if(data?.status!=='PENDING')continue;
   if(data.recipientEmail!==mail||typeof data.groupId!=='string')stopped('INVITATION_INTEGRITY');
   const group=await db.collection('groups').doc(data.groupId).get();
   if(!group.exists)continue;
   if(group.id===primary.id)stopped('ACTIVE_PRIMARY_PENDING_CONFLICT');
   if(group.data()?.deleteState!=='DELETING')continue;
   if(group.data()?.ownerUid!==root.uid)stopped('RETIRED_NOTEBOOK_OTHER_OWNER');
   if(data.role!=='VIEWER')stopped('PENDING_ROLE_NOT_VIEWER');
   const sent=await group.ref.collection('sentInvites').doc(inv.id).get();
   if(!sent.exists||sent.data()?.groupId!==group.id||
      sent.data()?.recipientEmail!==mail||sent.data()?.role!=='VIEWER')
    stopped('OLD_INVITATION_SENT_PROOF_MISMATCH');
   oldInvites.push({inv,group,sent,editor,mail});
  }
 }
 if(oldInvites.length!==1)stopped('EXPECTED_EXACTLY_ONE_RETIRED_VIEWER_INVITE_COUNT_'+oldInvites.length);
 const item=oldInvites[0];
 // Atomic status-only UPDATE. Every reference is re-read INSIDE the transaction
 // to protect against changes between audit and mutation.
 await db.runTransaction(async tx=>{
  const [oldDoc,retiredRoot,primaryDoc,memberDoc,sentDoc]=await Promise.all([
   tx.get(item.inv.ref),tx.get(item.group.ref),tx.get(primary.ref),
   tx.get(item.editor.ref),tx.get(item.sent.ref)]);
  const invite=oldDoc.data(),retired=retiredRoot.data(),active=primaryDoc.data(),member=memberDoc.data();
  if(!oldDoc.exists||invite?.status!=='PENDING'||invite?.role!=='VIEWER'||
     invite?.groupId!==item.group.id||invite?.recipientEmail!==item.mail)
   stopped('PENDING_INVITE_CHANGED');
  if(!retiredRoot.exists||retired?.deleteState!=='DELETING'||retired?.ownerUid!==root.uid)
   stopped('RETIRED_NOTEBOOK_CHANGED');
  if(!primaryDoc.exists||active?.name!=='鴻繽'||active?.ownerUid!==root.uid||active?.deleteState)
   stopped('PRIMARY_NOTEBOOK_CHANGED');
  if(!memberDoc.exists||member?.uid!==item.editor.id||
     member?.status!=='ACTIVE'||member?.role!=='EDITOR')
   stopped('PRIMARY_EDITOR_CHANGED');
  if(!sentDoc.exists||sentDoc.data()?.groupId!==item.group.id||
     sentDoc.data()?.recipientEmail!==item.mail||sentDoc.data()?.role!=='VIEWER')
   stopped('OLD_INVITE_SENT_INDEX_CHANGED');
  tx.update(item.inv.ref,{status:'REVOKED'});
 });
 const [after,stillEditor,stillGroup]=await Promise.all([
  item.inv.ref.get(),item.editor.ref.get(),primary.ref.get()]);
 if(after.data()?.status!=='REVOKED'||stillEditor.data()?.role!=='EDITOR'||
   stillEditor.data()?.status!=='ACTIVE'||stillGroup.data()?.deleteState)
  stopped('READBACK_NOT_VERIFIED');
 console.log('RETIRED_TEST_INVITE_REVOKED_ONE_STATUS_FIELD_PASS');
 console.log('ACTIVE_PRIMARY_EDITOR_ROLE_PRESERVED_PASS');
 console.log('NO_GROUP_NOTES_TASKS_OR_MEMBERS_MODIFIED_PASS');
}catch(err){
 // No private record identities, path, email or Firebase API payload in logs.
 const code=String(err?.message||'');
 console.error(code.startsWith('RETIRED_INVITE_SAFE_HOLD_')?code:
  err?.code==='permission-denied'?'RETIRED_INVITE_SAFE_HOLD_FIRESTORE_WRITE_DENIED':
  'RETIRED_INVITE_SAFE_HOLD_SERVER_EXECUTION_ERROR');
 process.exitCode=1;
}finally{await deleteApp(app)}
