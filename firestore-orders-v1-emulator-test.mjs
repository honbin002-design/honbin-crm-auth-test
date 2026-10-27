// Synthetic order records and identities only. NEVER connects to live Firebase.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
const env=await initializeTestEnvironment({projectId:'demo-honbin-orders-v1',
 firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('.test-rules/firestore.emulator.rules','utf8')}});
const auth=(uid,email)=>env.authenticatedContext(uid,{email,email_verified:true,
 firebase:{sign_in_provider:'google.com'}}).firestore();
const viewer=auth('uid_viewer','viewer@example.com'),outsider=auth('uid_outside','outside@example.com');
const owner='uid_owner',uid='uid_viewer',root='groups/group_test/orders/order_test';
const serverTime=()=>firebase.firestore.FieldValue.serverTimestamp();
const details={productName:'PUR 631',specification:'',quantity:20,unit:'KG',supplierName:'TEST',
 requesterUid:uid,orderedByUid:'',orderDate:'',dueDate:'2026-11-05',
 arrivedQuantity:0,status:'PENDING',note:''};
const order=(rev,lastAudit,actor,body=details)=>({
 details:body,isCompleted:body.status==='RECEIVED',revision:rev,
 createdBy:uid,createdAt:serverTime(),updatedBy:actor,
 updatedAt:serverTime(),lastAuditId:lastAudit});
const audit=(revision,id,kind,before,after)=>({
 orderId:'order_test',revision,actorUid:id,changedAt:serverTime(),kind,before,after});
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await db.doc('groups/group_test').set({ownerUid:owner,name:'TEST',createdAt:new Date()});
  await db.doc('approvedAccounts/viewer@example.com').set({email:'viewer@example.com',status:'ACTIVE'});
  await db.doc('groups/group_test/members/'+uid).set({uid,role:'VIEWER',status:'ACTIVE',invitationId:'synthetic'});
 });
 await assertFails(outsider.collection('groups/group_test/orders').get());
 await assertFails(outsider.doc(root).set(order(1,'a','uid_outside')));
 await assertFails(viewer.doc(root).set(order(1,'missing',uid)));
 await assertFails(viewer.doc(root).set(order(1,'h-forged',uid,{...details,requesterUid:'uid_owner'})));
 await assertSucceeds(viewer.runTransaction(async tx=>{
  tx.set(viewer.doc(root),order(1,'h1',uid));
  tx.set(viewer.doc(root+'/history/h1'),audit(1,uid,'CREATE',{},details));
 }));
 const old=await viewer.doc(root).get();assert.equal(old.data().revision,1);
 await assertFails(viewer.doc(root).update({details:{...details,status:'RECEIVED',arrivedQuantity:20}}));
 await assertFails(viewer.doc(root+'/history/h1').delete());
 await assertFails(viewer.doc(root).delete());
 const next={...details,status:'RECEIVED',arrivedQuantity:20,orderDate:'2026-10-27',orderedByUid:uid};
 await assertSucceeds(viewer.runTransaction(async tx=>{
  const current=await tx.get(viewer.doc(root));
  assert.equal(current.data().revision,1);
  tx.update(viewer.doc(root),{details:next,isCompleted:true,revision:2,
   updatedBy:uid,updatedAt:serverTime(),lastAuditId:'h2'});
  tx.set(viewer.doc(root+'/history/h2'),audit(2,uid,'UPDATE',details,next));
 }));
 const final=await viewer.doc(root).get();assert.equal(final.data().revision,2);
 assert.equal(final.data().isCompleted,true);
 await assertFails(viewer.doc(root+'/history/h2').update({actorUid:'uid_owner'}));
 console.log('ORDERS_V1_FIRESTORE_ATOMIC_AUDIT_AND_DENIAL_PASS');
}finally{await env.cleanup()}
