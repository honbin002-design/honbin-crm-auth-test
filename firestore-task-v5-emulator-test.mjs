// Firebase emulator ONLY. All identities and documents synthetic.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
const projectId='demo-honbin-task-v5-pending-gate';
const env=await initializeTestEnvironment({
 projectId,firestore:{host:'127.0.0.1',port:8080,
  rules:readFileSync('.test-rules/firestore.emulator.rules','utf8')}
});
const uidOwner='uid_owner',uidViewer='uid_viewer',uidOther='uid_other';
const auth=(uid,email)=>env.authenticatedContext(uid,{
 email,email_verified:true,firebase:{sign_in_provider:'google.com'}
}).firestore();
const timestamp=()=>firebase.firestore.FieldValue.serverTimestamp();
const owner=auth(uidOwner,'honbin002@gmail.com');
const viewer=auth(uidViewer,'viewer@example.com');
const other=auth(uidOther,'other@example.com');
const outsider=auth('uid_outside','outside@example.com');
const base='groups/group_test/tasks/';
const task=(uid,assignee)=>({
 title:'Synthetic task',description:'emulator only',assignedUid:assignee,
 executeDate:'2026-10-21',dueDate:'2026-10-30',status:'OPEN',
 createdBy:uid,createdAt:timestamp(),completedBy:null,completedAt:null,
 completionReply:''
});
const request=(uid,newDueDate,reason,originalDueDate='2026-10-30')=>({
 requestedBy:uid,requestedAt:timestamp(),newDueDate,reason,originalDueDate,
 status:'PENDING',decidedBy:null,decidedAt:null
});
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await db.doc('groups/group_test').set({ownerUid:uidOwner,name:'TEST',createdAt:new Date()});
  for(const [uid,email] of [[uidViewer,'viewer@example.com'],[uidOther,'other@example.com']]){
   await db.doc('approvedAccounts/'+email).set({email,status:'ACTIVE',createdAt:new Date()});
   await db.doc('groups/group_test/members/'+uid).set({
    uid,role:'VIEWER',status:'ACTIVE',invitationId:'synthetic'
   });
  }
 });
 await assertSucceeds(viewer.doc(base+'viewer_created').set(task(uidViewer,uidViewer)));
 await assertSucceeds(viewer.collection('groups/group_test/tasks').get());
 await assertFails(outsider.collection('groups/group_test/tasks').get());
 await assertFails(viewer.doc(base+'forged_publisher').set(task(uidOwner,uidViewer)));
 await assertFails(viewer.doc(base+'fake_done').set({
  ...task(uidViewer,uidViewer),status:'DONE',completedBy:uidViewer
 }));
 await assertFails(viewer.doc(base+'invalid_assignee').set(task(uidViewer,'uid_outside')));
 await assertFails(outsider.doc(base+'outside').set(task('uid_outside',null)));
 await assertFails(viewer.doc('groups/group_test/notes/forbidden').set({title:'forbidden'}));
 await assertSucceeds(owner.doc(base+'assigned').set(task(uidOwner,uidViewer)));
 await assertFails(viewer.doc(base+'assigned').update({dueDate:'2026-11-05'}));
 await assertFails(other.doc(base+'assigned').update({extensionPendingId:'forged'}));
 // V5 immutable original-deadline audit: client cannot omit or falsify.
 await assertFails(viewer.runTransaction(async tx=>{
  const parent=viewer.doc(base+'assigned'),child=viewer.doc(base+'assigned/extensionRequests/without_original');
  await tx.get(parent);
  const payload=request(uidViewer,'2026-11-05','Missing original');
  delete payload.originalDueDate;
  tx.update(parent,{extensionPendingId:'without_original'});
  tx.set(child,payload);
 }));
 await assertFails(viewer.runTransaction(async tx=>{
  const parent=viewer.doc(base+'assigned'),child=viewer.doc(base+'assigned/extensionRequests/forged_original');
  await tx.get(parent);
  tx.update(parent,{extensionPendingId:'forged_original'});
  tx.set(child,request(uidViewer,'2026-11-05','Forged original','2026-10-29'));
 }));
 await assertSucceeds(viewer.runTransaction(async tx=>{
  const parent=viewer.doc(base+'assigned'),child=viewer.doc(base+'assigned/extensionRequests/r1');
  await tx.get(parent);
  tx.update(parent,{extensionPendingId:'r1'});
  tx.set(child,request(uidViewer,'2026-11-05','Need more time'));
 }));
 const pending=await viewer.doc(base+'assigned/extensionRequests/r1').get();
 assert.equal(pending.data().status,'PENDING');
 assert.equal(pending.data().originalDueDate,'2026-10-30');
 await assertFails(viewer.runTransaction(async tx=>{
  const parent=viewer.doc(base+'assigned'),child=viewer.doc(base+'assigned/extensionRequests/r_extra');
  await tx.get(parent);
  tx.update(parent,{extensionPendingId:'r_extra'});
  tx.set(child,request(uidViewer,'2026-11-09','duplicate while pending'));
 }));
 await assertFails(viewer.doc(base+'assigned/extensionRequests/r1').update({reason:'tampered'}));
 await assertFails(other.doc(base+'assigned/extensionRequests/r1').delete());
 assert.equal((await owner.doc(base+'assigned').get()).data().dueDate,'2026-10-30');
 await assertFails(viewer.doc(base+'assigned').update({dueDate:'2026-11-05'}));
 await assertFails(other.doc(base+'assigned/extensionRequests/r1').update({
  status:'APPROVED',decidedBy:uidOther,decidedAt:timestamp()
 }));
 // Publisher may select a DIFFERENT approved date from applicant's proposal.
 // Forged / mismatched dates and missing immutable approval audit are denied.
 await assertFails(owner.runTransaction(async tx=>{
  const parent=owner.doc(base+'assigned'),child=owner.doc(base+'assigned/extensionRequests/r1');
  await tx.get(parent);await tx.get(child);
  tx.update(parent,{extensionPendingId:null,dueDate:'2026-11-02'});
  tx.update(child,{status:'APPROVED',decidedBy:uidOwner,decidedAt:timestamp()});
 }));
 await assertFails(owner.runTransaction(async tx=>{
  const parent=owner.doc(base+'assigned'),child=owner.doc(base+'assigned/extensionRequests/r1');
  await tx.get(parent);await tx.get(child);
  tx.update(parent,{extensionPendingId:null,dueDate:'2026-11-03'});
  tx.update(child,{status:'APPROVED',approvedDueDate:'2026-11-02',decidedBy:uidOwner,decidedAt:timestamp()});
 }));
 await assertFails(owner.runTransaction(async tx=>{
  const parent=owner.doc(base+'assigned'),child=owner.doc(base+'assigned/extensionRequests/r1');
  await tx.get(parent);await tx.get(child);
  tx.update(parent,{extensionPendingId:null,dueDate:'2026-10-29'});
  tx.update(child,{status:'APPROVED',approvedDueDate:'2026-10-29',decidedBy:uidOwner,decidedAt:timestamp()});
 }));
 await assertSucceeds(owner.runTransaction(async tx=>{
  const parent=owner.doc(base+'assigned'),child=owner.doc(base+'assigned/extensionRequests/r1');
  await tx.get(parent);await tx.get(child);
  tx.update(parent,{extensionPendingId:null,dueDate:'2026-11-02'});
  tx.update(child,{status:'APPROVED',approvedDueDate:'2026-11-02',decidedBy:uidOwner,decidedAt:timestamp()});
 }));
 assert.equal((await owner.doc(base+'assigned').get()).data().dueDate,'2026-11-02');
 assert.equal((await owner.doc(base+'assigned/extensionRequests/r1').get()).data().newDueDate,'2026-11-05');
 assert.equal((await owner.doc(base+'assigned/extensionRequests/r1').get()).data().originalDueDate,'2026-10-30');
 assert.equal((await owner.doc(base+'assigned/extensionRequests/r1').get()).data().approvedDueDate,'2026-11-02');
 await assertFails(owner.doc(base+'assigned/extensionRequests/r1').delete());
 await assertFails(owner.doc(base+'assigned/extensionRequests/r1').update({reason:'rewritten'}));
 await assertSucceeds(viewer.runTransaction(async tx=>{
  const parent=viewer.doc(base+'assigned'),child=viewer.doc(base+'assigned/extensionRequests/r2');
  await tx.get(parent);
  tx.update(parent,{extensionPendingId:'r2'});
  tx.set(child,request(uidViewer,'2026-11-10','Second request','2026-11-02'));
 }));
 await assertSucceeds(owner.runTransaction(async tx=>{
  const parent=owner.doc(base+'assigned'),child=owner.doc(base+'assigned/extensionRequests/r2');
  await tx.get(parent);await tx.get(child);
  tx.update(parent,{extensionPendingId:null});
  tx.update(child,{status:'REJECTED',decidedBy:uidOwner,decidedAt:timestamp()});
 }));
 assert.equal((await owner.doc(base+'assigned').get()).data().dueDate,'2026-11-02');
 assert.equal((await owner.doc(base+'assigned/extensionRequests/r1').get()).data().status,'APPROVED');
 await assertFails(owner.doc(base+'assigned/extensionRequests/r1').update({
  status:'REJECTED',decidedBy:uidOwner,decidedAt:timestamp()
 }));
 await assertFails(viewer.doc(base+'assigned').update({createdBy:uidViewer}));
 assert.equal((await owner.doc(base+'assigned/extensionRequests/r2').get()).data().status,'REJECTED');
 // V5: a pending extension must block completion at SERVER LEVEL, not only UI.
 await assertSucceeds(owner.doc(base+'completion_gate').set(task(uidOwner,uidViewer)));
 await assertSucceeds(viewer.runTransaction(async tx=>{
  const parent=viewer.doc(base+'completion_gate');
  const child=viewer.doc(base+'completion_gate/extensionRequests/g1');
  await tx.get(parent);
  tx.update(parent,{extensionPendingId:'g1'});
  tx.set(child,request(uidViewer,'2026-11-08','Need extension before completing'));
 }));
 await assertFails(viewer.doc(base+'completion_gate').update({
  status:'DONE',completedBy:uidViewer,completedAt:timestamp(),completionReply:'Should be blocked while pending'
 }));
 await assertSucceeds(owner.runTransaction(async tx=>{
  const parent=owner.doc(base+'completion_gate');
  const child=owner.doc(base+'completion_gate/extensionRequests/g1');
  await tx.get(parent);await tx.get(child);
  tx.update(parent,{extensionPendingId:null});
  tx.update(child,{status:'REJECTED',decidedBy:uidOwner,decidedAt:timestamp()});
 }));
 await assertSucceeds(viewer.doc(base+'completion_gate').update({
  status:'DONE',completedBy:uidViewer,completedAt:timestamp(),completionReply:'Allowed after resolution'
 }));
 assert.equal((await owner.doc(base+'completion_gate').get()).data().status,'DONE');
 assert.equal((await owner.doc(base+'completion_gate/extensionRequests/g1').get()).data().status,'REJECTED');
 console.log('TASK_V5_EMULATOR_PENDING_COMPLETION_DENIED_PASS');
}finally{await env.cleanup()}
