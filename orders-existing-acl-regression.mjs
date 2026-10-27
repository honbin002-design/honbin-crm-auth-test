// Emulator only: prove new orders rules do not grant access to existing private paths.
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
const env=await initializeTestEnvironment({projectId:'demo-honbin-orders-v1',firestore:{
 host:'127.0.0.1',port:8080,rules:readFileSync('.test-rules/firestore.emulator.rules','utf8')}});
const auth=(uid,email)=>env.authenticatedContext(uid,{email,email_verified:true,
 firebase:{sign_in_provider:'google.com'}}).firestore();
const owner=auth('uid_owner','honbin002@gmail.com');
const viewer=auth('uid_viewer','viewer@example.com');
const outsider=auth('uid_outside','outside@example.com');
const time=()=>firebase.firestore.FieldValue.serverTimestamp();
try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  await db.doc('groups/g').set({ownerUid:'uid_owner',name:'TEST',createdAt:new Date()});
  await db.doc('approvedAccounts/viewer@example.com').set({email:'viewer@example.com',status:'ACTIVE'});
  await db.doc('groups/g/members/uid_viewer').set({uid:'uid_viewer',role:'VIEWER',status:'ACTIVE'});
  await db.doc('groups/g/notes/n').set({ownerUid:'uid_owner',groupId:'g',title:'test',content:'test',version:1,deleted:false,createdAt:new Date(),updatedAt:new Date()});
  await db.doc('users/uid_owner/notes/n').set({content:'private'});
  await db.doc('pushSubscriptions/uid_owner/devices/d').set({endpoint:'synthetic'});
  await db.doc('ownerSupplierPrices/uid_owner/entries/'+'a'.repeat(64)).set({price:1});
 });
 await assertSucceeds(viewer.doc('groups/g/notes/n').get());
 await assertFails(viewer.doc('groups/g/notes/n').update({content:'forged',version:2,updatedAt:time()}));
 await assertFails(viewer.doc('users/uid_owner/notes/n').get());
 await assertFails(viewer.doc('pushSubscriptions/uid_owner/devices/d').get());
 await assertFails(viewer.collection('approvedAccounts').get());
 await assertFails(viewer.doc('groups/g/members/uid_viewer').update({role:'ADMIN'}));
 await assertFails(viewer.collection('ownerSupplierPrices/uid_owner/entries').get());
 await assertSucceeds(owner.collection('ownerSupplierPrices/uid_owner/entries').get());
 await assertFails(outsider.doc('groups/g/notes/n').get());
 await assertFails(outsider.collection('groups/g/orders').get());
 await env.withSecurityRulesDisabled(c=>c.firestore().doc('groups/g/members/uid_viewer').update({status:'REVOKED'}));
 await assertFails(viewer.collection('groups/g/orders').get());
 await assertFails(viewer.doc('groups/g/notes/n').get());
 console.log('ORDERS_EXISTING_NOTES_TASKS_ACCOUNT_PUSH_PRICE_ACL_REGRESSION_PASS');
}finally{await env.cleanup()}
