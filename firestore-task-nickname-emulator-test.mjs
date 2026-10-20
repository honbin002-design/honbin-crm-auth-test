// All documents/identities are synthetic; Firebase Emulator only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds}
 from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const projectId='demo-honbin-task-isolation';
const uidOwner='uid_owner',uidViewer='uid_viewer',uidOther='uid_other';
const uidEditor='uid_editor',uidOutside='uid_outside';
const emailViewer='viewer@example.com',emailOther='other@example.com';
const emailEditor='editor@example.com',emailOutside='outside@example.com';
const rules=readFileSync('.test-rules/firestore.emulator.rules','utf8');
const env=await initializeTestEnvironment({
 projectId,firestore:{host:'127.0.0.1',port:8080,rules}
});
const auth=(uid,email)=>env.authenticatedContext(uid,{
 email,email_verified:true,firebase:{sign_in_provider:'google.com'}
}).firestore();
const timestamp=()=>firebase.firestore.FieldValue.serverTimestamp();
const owner=auth(uidOwner,'honbin002@gmail.com'),viewer=auth(uidViewer,emailViewer),
 other=auth(uidOther,emailOther),editor=auth(uidEditor,emailEditor),
 outside=auth(uidOutside,emailOutside);
const task=(title,assignedUid)=>({
 title,description:'only synthetic records',assignedUid,executeDate:'2026-10-21',
 dueDate:'2026-10-30',createdBy:uidOwner,createdAt:timestamp(),
 status:'OPEN',completedBy:null,completedAt:null,completionReply:''
});
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await db.doc('groups/group_test').set({
   ownerUid:uidOwner,name:'TEST ONLY',createdAt:new Date()
  });
  for(const [uid,email] of [[uidViewer,emailViewer],[uidOther,emailOther],
      [uidEditor,emailEditor],[uidOutside,emailOutside]]){
   await db.doc('approvedAccounts/'+email).set({email,status:'ACTIVE',createdAt:new Date()});
   if(uid!==uidOutside)await db.doc('groups/group_test/members/'+uid).set({
    uid,role:uid===uidEditor?'EDITOR':'VIEWER',status:'ACTIVE',
    invitationId:'synthetic_invite'
   });
  }
 });
 const path='groups/group_test/tasks/';
 await assertSucceeds(owner.doc(path+'assigned').set(task('Owner assigned',uidViewer)));
 await assertSucceeds(editor.doc(path+'editor_created').set({
  ...task('Editor assigned',uidViewer),createdBy:uidEditor
 }));
 await assertFails(outside.doc(path+'assigned').get());
 await assertFails(viewer.doc(path+'illegal_viewer_create').set(task('not allowed',null)));
 await assertFails(other.doc(path+'assigned').update({
  status:'DONE',completedBy:uidOther,completedAt:timestamp(),completionReply:'wrong user'
 }));
 await assertSucceeds(viewer.doc(path+'assigned').update({
  status:'DONE',completedBy:uidViewer,completedAt:timestamp(),completionReply:'done by viewer'
 }));
 await assertFails(viewer.doc(path+'assigned').update({
  completionReply:'attempt overwrite'
 }));
 await assertFails(viewer.doc(path+'assigned').update({
  title:'tampered task'
 }));
 await assertFails(other.doc(path+'assigned').update({
  completedAt:new Date()
 }));
 await assertSucceeds(owner.doc(path+'everyone').set(task('Unassigned',null)));
 await assertSucceeds(other.doc(path+'everyone').update({
  status:'DONE',completedBy:uidOther,completedAt:timestamp(),completionReply:'completed'
 }));
 await assertFails(viewer.doc(path+'everyone').update({
  status:'DONE',completedBy:uidViewer,completedAt:timestamp(),completionReply:'second completer'
 }));
 await assertSucceeds(viewer.doc('profiles/'+uidViewer).set({
  nickname:'VIC',updatedAt:timestamp()
 }));
 await assertSucceeds(owner.doc('profiles/'+uidViewer).get());
 await assertFails(other.doc('profiles/'+uidViewer).set({
  nickname:'hijack',updatedAt:timestamp()
 }));
 await assertSucceeds(viewer.doc('profiles/'+uidViewer).update({
  nickname:'威',updatedAt:timestamp()
 }));
 const profile=await other.doc('profiles/'+uidViewer).get();
 assert.equal(profile.data().nickname,'威');
 await assertFails(other.collection('profiles').get());
 // Push endpoint keys are readable only by the owning account.
 const device='pushSubscriptions/'+uidViewer+'/devices/iphone_1';
 const subscription={
  endpoint:'https://web.push.apple.com/synthetic_push_endpoint',
  p256dh:'A'.repeat(65),auth:'B'.repeat(24),
  createdAt:timestamp(),updatedAt:timestamp()
 };
 await assertSucceeds(viewer.doc(device).set(subscription));
 await assertSucceeds(viewer.doc(device).get());
 await assertFails(other.doc(device).get());
 await assertFails(other.doc(device).set(subscription));
 await assertFails(owner.doc(device).get());
 await assertFails(viewer.doc('pushSubscriptions/'+uidViewer+'/devices/iphone_2')
   .set({...subscription,endpoint:'https://attacker.example.test/collect'}));
 await assertSucceeds(viewer.doc(device).update({
  updatedAt:timestamp()
 }));
 await assertFails(viewer.doc(device).update({
  createdAt:timestamp(),updatedAt:timestamp()
 }));
 await assertSucceeds(viewer.doc(device).delete());
 // The pre-existing note ACL is unchanged by the two new match blocks.
 const noteRef='groups/group_test/notes/synthetic_note';
 await assertSucceeds(owner.doc(noteRef).set({
  ownerUid:uidOwner,groupId:'group_test',title:'old note',
  content:'unchanged',createdAt:timestamp(),updatedAt:timestamp(),
  version:1,deleted:false
 }));
 await assertFails(viewer.doc(noteRef).update({
  content:'viewer attempted edit',updatedAt:timestamp(),version:2
 }));
 await env.withSecurityRulesDisabled(async ctx=>{
  await ctx.firestore().doc('groups/group_test/members/'+uidOther)
    .update({status:'REVOKED'});
 });
 await assertFails(other.doc(path+'assigned').get());
 await assertFails(other.doc(path+'editor_created').update({
  status:'DONE',completedBy:uidOther,completedAt:timestamp(),completionReply:'revoked'
 }));
 const final=await owner.doc(path+'assigned').get();
 assert.equal(final.data().completedBy,uidViewer);
 assert.equal(final.data().completionReply,'done by viewer');
 assert.ok(final.data().completedAt,'server completion timestamp required');
 console.log('FIRESTORE_EMULATOR_TASK_VIEWER_AND_PROFILE_ACL_PASS');
}finally{await env.cleanup()}
