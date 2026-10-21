// Firebase emulator ONLY. All identities and documents synthetic.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
const projectId='demo-honbin-task-v3-extension';
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
const request=(uid,newDueDate,reason)=>({
 requestedBy:uid,requestedAt:timestamp(),newDueDate,reason,
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
 await assertSucceeds(viewer.runTransaction(async tx=>{
  const parent=viewer.doc(base+'assigned'),child=viewer.doc(base+'assigned/extensionRequests/r1');
  await tx.get(parent);
  tx.update(parent,{extensionPendingId:'r1'});
  tx.set(child,request(uidViewer,'2026-11-05','Need more time'));
 }));
 const pending=await viewer.doc(base+'assigned/extensionRequests/r1').get();
 assert.equal(pending.data().status,'PENDING');
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
 await assertSucceeds(owner.runTransaction(async tx=>{
  const parent=owner.doc(base+'assigned'),child=owner.doc(base+'assigned/extensionRequests/r1');
  await tx.get(parent);await tx.get(child);
  tx.update(parent,{extensionPendingId:null,dueDate:'2026-11-05'});
  tx.update(child,{status:'APPROVED',decidedBy:uidOwner,decidedAt:timestamp()});
 }));
 assert.equal((await owner.doc(base+'assigned').get()).data().dueDate,'2026-11-05');
 await assertFails(owner.doc(base+'assigned/extensionRequests/r1').delete());
 await assertFails(owner.doc(base+'assigned/extensionRequests/r1').update({reason:'rewritten'}));
 await assertSucceeds(viewer.runTransaction(async tx=>{
  const parent=viewer.doc(base+'assigned'),child=viewer.doc(base+'assigned/extensionRequests/r2');
  await tx.get(parent);
  tx.update(parent,{extensionPendingId:'r2'});
  tx.set(child,request(uidViewer,'2026-11-10','Second request'));
 }));
 await assertSucceeds(owner.runTransaction(async tx=>{
  const parent=owner.doc(base+'assigned'),child=owner.doc(base+'assigned/extensionRequests/r2');
  await tx.get(parent);await tx.get(child);
  tx.update(parent,{extensionPendingId:null});
  tx.update(child,{status:'REJECTED',decidedBy:uidOwner,decidedAt:timestamp()});
 }));
 assert.equal((await owner.doc(base+'assigned').get()).data().dueDate,'2026-11-05');
 assert.equal((await owner.doc(base+'assigned/extensionRequests/r1').get()).data().status,'APPROVED');
 await assertFails(owner.doc(base+'assigned/extensionRequests/r1').update({
  status:'REJECTED',decidedBy:uidOwner,decidedAt:timestamp()
 }));
 await assertFails(viewer.doc(base+'assigned').update({createdBy:uidViewer}));
 assert.equal((await owner.doc(base+'assigned/extensionRequests/r2').get()).data().status,'REJECTED');
 console.log('TASK_V3_EMULATOR_ALL_MEMBER_AND_EXTENSION_PASS');
}finally{await env.cleanup()}
