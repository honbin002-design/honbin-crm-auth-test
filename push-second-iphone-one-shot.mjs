// One-time opt-in QA. DO NOT activate periodic sender. No Firestore writes.
// Exact target is verified by SHA256(normalized Google email), not by notebook
// nickname or screen labels; no recipient addresses/UIDs/endpoints in logs.
import {createHash} from 'node:crypto';
const PROJECT='honbin-crm-notes-spark',ROOT_EMAIL='honbin002@gmail.com';
const TARGET_EMAIL_HASH='68cc7610f58341fe00bd8b1161b5bb0ceb0a6e7137a9b4ea83ed977a536f5eca';
const EXPECTED_PUB='BKK0gtCmZKxUCBBpZvuik5z8I4ogHXrVEPsVurnxE9bObfmXEmTw-wIBCePf_hSieDNPqBoJ-62q2MyK-0VtaJE';
const EXPECTED_SENDER='honbin-test-push-sender@'+PROJECT+'.iam.gserviceaccount.com';
const safeStop=code=>{throw Error('SECOND_IPHONE_SAFE_STOP_'+code)};
if(process.env.TEST_PUSH_SEND_ENABLED==='EXPLICITLY_APPROVED')safeStop('PERIODIC_SENDER_UNEXPECTED');
if(process.env.SECOND_IPHONE_ALREADY_SUBSCRIBED!=='yes')safeStop('NO_EXPLICIT_DEVICE_EVIDENCE');
for(const key of ['TEST_FIREBASE_SERVICE_ACCOUNT_JSON','TEST_VAPID_PUBLIC_KEY',
 'TEST_VAPID_PRIVATE_KEY','TEST_PUSH_CONTACT']){
 if(!process.env[key])safeStop('MISSING_'+key);
}
if(process.env.TEST_VAPID_PUBLIC_KEY!==EXPECTED_PUB)safeStop('VAPID_PUB_CHANGED');
if(!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.TEST_PUSH_CONTACT))
 safeStop('INVALID_CONTACT');
let cred;try{cred=JSON.parse(process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON)}catch{safeStop('INVALID_CREDENTIAL')}
if(cred.project_id!==PROJECT||cred.type!=='service_account'||
 cred.client_email!==EXPECTED_SENDER||!String(cred.private_key||'').includes('-----BEGIN PRIVATE KEY-----'))
 safeStop('DEDICATED_SERVICE_IDENTITY_MISMATCH');
const [{initializeApp,cert,deleteApp},{getAuth},{getFirestore},{default:webpush}]=await Promise.all([
 import('firebase-admin/app'),import('firebase-admin/auth'),
 import('firebase-admin/firestore'),import('web-push')
]);
const app=initializeApp({credential:cert(cred),projectId:PROJECT});
try{
 const auth=getAuth(app),db=getFirestore(app);
 const owner=await auth.getUserByEmail(ROOT_EMAIL);
 if(!owner||!owner.emailVerified||!owner.providerData.some(x=>x.providerId==='google.com'))
  safeStop('OWNER_REFERENCE_UNVERIFIED');
 const users=await auth.listUsers(30);
 if(users.pageToken)safeStop('USER_DIRECTORY_OVER_LIMIT');
 const matches=users.users.filter(u=>u.emailVerified&&u.email&&
  u.providerData.some(p=>p.providerId==='google.com')&&
  createHash('sha256').update(u.email.toLowerCase()).digest('hex')===TARGET_EMAIL_HASH);
 if(matches.length!==1)safeStop('SECOND_GOOGLE_IDENTITY_NOT_UNIQUE');
 const target=matches[0];
 if(target.uid===owner.uid)safeStop('SECOND_MUST_DIFFER_FROM_OWNER');
 const approve=await db.collection('approvedAccounts').doc(target.email.toLowerCase()).get();
 if(!approve.exists||approve.data()?.status!=='ACTIVE'||
    approve.data()?.email!==target.email.toLowerCase())
  safeStop('SECOND_CRM_ACCOUNT_NOT_APPROVED');
 const index=await db.collection('users').doc(owner.uid).collection('groupIndex').limit(11).get();
 if(index.size>10)safeStop('TOO_MANY_OWNER_GROUPS');
 const matching=[];
 for(const pointer of index.docs){
  const group=await db.collection('groups').doc(pointer.id).get();
  if(group.exists&&group.data().name==='鴻繽'&&group.data().ownerUid===owner.uid&&
    !group.data().deleteState)matching.push(group);
 }
 if(matching.length!==1)safeStop('PRIMARY_NOTEBOOK_NOT_UNIQUE');
 const member=await matching[0].ref.collection('members').doc(target.uid).get();
 if(!member.exists||member.data().uid!==target.uid||member.data().status!=='ACTIVE'||
    member.data().role!=='EDITOR')safeStop('EDITOR_MEMBERSHIP_NOT_CONFIRMED');
 const second=await db.collection('pushSubscriptions').doc(target.uid)
  .collection('devices').limit(5).get();
 if(second.size>4)safeStop('DEVICE_LIMIT_EXCEEDED');
 const devices=second.docs.filter(d=>!d.id.startsWith('probe_'));
 if(devices.length!==1)safeStop('EXACTLY_ONE_SECOND_DEVICE_REQUIRED');
 const record=devices[0].data();
 let endpoint;try{endpoint=new URL(record.endpoint)}catch{safeStop('ENDPOINT_UNREADABLE')}
 if(endpoint.protocol!=='https:'||endpoint.hostname!=='web.push.apple.com'||
    endpoint.username||endpoint.password||endpoint.port||
    typeof record.p256dh!=='string'||!/^[A-Za-z0-9_-]{40,150}$/.test(record.p256dh)||
    typeof record.auth!=='string'||!/^[A-Za-z0-9_-]{12,130}$/.test(record.auth))
  safeStop('NOT_VERIFIED_APPLE_SUBSCRIPTION');
 const created=record.createdAt?.toMillis?.();
 if(!Number.isFinite(created)||created>Date.now()+60000||
   Date.now()-created>7*24*60*60*1000)safeStop('DEVICE_REGISTRATION_STALE');
 const first=await db.collection('pushSubscriptions').doc(owner.uid).collection('devices').limit(5).get();
 if(first.docs.some(d=>!d.id.startsWith('probe_')&&d.data()?.endpoint===record.endpoint))
   safeStop('DEVICE_DUPLICATED_ACROSS_ACCOUNTS');
 webpush.setVapidDetails(process.env.TEST_PUSH_CONTACT,
  process.env.TEST_VAPID_PUBLIC_KEY,process.env.TEST_VAPID_PRIVATE_KEY);
 try{
  const sent=await webpush.sendNotification({
   endpoint:record.endpoint,keys:{p256dh:record.p256dh,auth:record.auth}
  },JSON.stringify({kind:'SECOND_ACCOUNT_ONE_TIME_TEST_NO_PRIVATE_DATA'}),{
   TTL:300,urgency:'normal',timeout:12000
  });
  if(![201,202].includes(sent?.statusCode))safeStop('APPLE_NOT_ACCEPTED');
  console.log('SECOND_APPROVED_EDITOR_ONE_SHOT_APPLE_ACCEPTED_'+sent.statusCode);
  console.log('NO_OTHER_MEMBER_NOTIFIED_NO_FIRESTORE_WRITES_SENDER_STAYS_OFF');
 }catch(error){
  console.error('SECOND_ONE_SHOT_DELIVERY_HOLD_STATUS_'+(Number(error?.statusCode)||'NETWORK'));
  process.exitCode=1;
 }
}finally{await deleteApp(app)}
