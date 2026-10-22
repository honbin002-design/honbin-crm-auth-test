// Strict TEST-only probe: check whether the existing dedicated sender may
// create/read/delete TWO *synthetic* dispatch bookkeeping docs.
// Never touch actual notes, tasks, groups, users, push subscriptions or cursors.
import {randomUUID} from 'node:crypto';
const PROJECT='honbin-crm-notes-spark',IDENTITY='honbin-test-push-sender@'+PROJECT+'.iam.gserviceaccount.com';
const stop=x=>{throw Error('PUSH_SENDER_WRITER_GATE_'+x)};
if(process.env.TEST_PUSH_SEND_ENABLED==='EXPLICITLY_APPROVED')stop('AUTO_SENDER_MUST_REMAIN_OFF');
let c;try{c=JSON.parse(process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON||'')}catch{stop('MISSING_CREDENTIAL')}
if(c.type!=='service_account'||c.project_id!==PROJECT||c.client_email!==IDENTITY||
 !String(c.private_key||'').includes('-----BEGIN PRIVATE KEY-----'))stop('DEDICATED_SERVICE_ACCOUNT_REQUIRED');
const [{initializeApp,cert,deleteApp},{getFirestore}]=await Promise.all([
 import('firebase-admin/app'),import('firebase-admin/firestore')]);
const app=initializeApp({projectId:PROJECT,credential:cert(c)});
const db=getFirestore(app),nonce=randomUUID().replaceAll('-','');
const references=[
 db.collection('notificationDeliveryLedger').doc('probe_'+nonce),
 db.collection('notificationSenderCursors').doc('probe_'+nonce)
];
const touched=new Set(),errors=[];
try{
 for(const ref of references){
  const prior=await ref.get();
  if(prior.exists)stop('COLLISION');
  touched.add(ref); // Cleanup even if a write's acknowledgement is lost.
  await ref.create({testProbe:true,marker:'never-send',createdAt:new Date()});
  const after=await ref.get();
  if(!after.exists||after.data().testProbe!==true||after.data().marker!=='never-send')
   stop('SERVER_WRITE_READBACK_MISMATCH');
 }
 console.log('TEST_SENDER_TWO_BOOKKEEPING_COLLECTION_WRITES_CONFIRMED');
}catch(e){
 errors.push(e?.code==='permission-denied'?'BOOKKEEPING_PERMISSION_DENIED':
  String(e?.message||e).startsWith('PUSH_SENDER_WRITER_GATE_')?
   String(e.message).replace('PUSH_SENDER_WRITER_GATE_',''):'WRITE_READBACK_FAILED');
}finally{
 for(const ref of touched){
  try{
   await ref.delete();
   if((await ref.get()).exists)errors.push('SYNTHETIC_CLEANUP_NOT_CONFIRMED');
  }catch{errors.push('SYNTHETIC_CLEANUP_FAILED')}
 }
 await deleteApp(app);
}
if(errors.length){
 console.error('TEST_SENDER_BOOKKEEPING_SAFE_HOLD_'+[...new Set(errors)].join('_'));
 process.exitCode=2;
}else console.log('TEST_SENDER_WRITE_READ_DELETE_PASS_NO_TEST_DATA_REMAINING');
