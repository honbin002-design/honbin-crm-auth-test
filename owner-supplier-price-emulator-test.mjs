import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {readFileSync} from 'node:fs';

const projectId='demo-honbin-owner-price';
const ownerUid='Iy5BWeZ17KW3Ost0m38LEhcjO9F3';
const rules=readFileSync('.test-rules/owner-supplier-price.rules','utf8');
const env=await initializeTestEnvironment({projectId,firestore:{rules,host:'127.0.0.1',port:8080}});
const claims=email=>({email,email_verified:true,firebase:{sign_in_provider:'google.com'}});
const owner=env.authenticatedContext(ownerUid,claims('honbin002@gmail.com')).firestore();
const other=env.authenticatedContext('OtherExistingAccount',claims('member@example.com')).firestore();
const outsider=env.unauthenticatedContext().firestore();
const id='a'.repeat(64),path=`ownerSupplierPrices/${ownerUid}/entries/${id}`;
const entry={supplierName:'虛構供應商',partNo:'S-1',productName:'虛構品',unit:'KG',price:100,sourceFileId:'synthetic',updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
try{
 await env.withSecurityRulesDisabled(async c=>{
  await c.firestore().doc('approvedAccounts/member@example.com').set({email:'member@example.com',status:'ACTIVE',createdAt:firebase.firestore.Timestamp.now()});
 });
 await assertFails(other.doc(path).get());
 await assertFails(outsider.doc(path).get());
 await assertFails(other.doc(path).set(entry));
 await assertFails(owner.doc(`ownerSupplierPrices/OtherExistingAccount/entries/${id}`).set(entry));
 await assertFails(owner.doc(path).set({...entry,privateLeak:'no'}));
 await assertFails(owner.doc(path).set({...entry,price:-1}));
 await assertSucceeds(owner.doc(path).set(entry));
 await assertSucceeds(owner.doc(path).get());
 await assertSucceeds(owner.collection(`ownerSupplierPrices/${ownerUid}/entries`).get());
 await assertFails(other.collection(`ownerSupplierPrices/${ownerUid}/entries`).get());
 await assertSucceeds(owner.doc(path).delete());
 console.log('OWNER_SUPPLIER_PRICE_ACL_PASS 11');
}finally{await env.cleanup()}
