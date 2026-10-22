// One-time owner-approved TEST only. Send <= ONE content-free push to
// the owner's sole currently enrolled iPhone. Never start the recurring sender.
import {createHash} from 'node:crypto';
const PROJECT='honbin-crm-notes-spark';
const OWNER='honbin002@gmail.com';
const EXPECTED_PUB='BKK0gtCmZKxUCBBpZvuik5z8I4ogHXrVEPsVurnxE9bObfmXEmTw-wIBCePf_hSieDNPqBoJ-62q2MyK-0VtaJE';
const who='honbin-test-push-sender@'+PROJECT+'.iam.gserviceaccount.com';
const deny=x=>{throw Error('OWNER_ONE_SHOT_SAFE_STOP_'+x)};
if(process.env.OWNER_SUBSCRIBED_SCREENSHOT_CONFIRMED!=='yes')deny('NO_LIVE_SUBSCRIPTION_EVIDENCE');
if(process.env.TEST_PUSH_SEND_ENABLED==='EXPLICITLY_APPROVED')deny('RECURRING_SENDER_MUST_BE_OFF');
const required=['TEST_FIREBASE_SERVICE_ACCOUNT_JSON','TEST_VAPID_PUBLIC_KEY',
 'TEST_VAPID_PRIVATE_KEY','TEST_PUSH_CONTACT'];
for(const key of required)if(!process.env[key])deny('MISSING_'+key);
if(process.env.TEST_VAPID_PUBLIC_KEY!==EXPECTED_PUB)deny('PUBLIC_VAPID_MISMATCH');
if(!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.TEST_PUSH_CONTACT))
 deny('VAPID_CONTACT_INVALID');
let cred;
try{cred=JSON.parse(process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON)}catch{deny('INVALID_CREDENTIAL')}
if(cred.type!=='service_account'||cred.project_id!==PROJECT||
 cred.client_email!==who||!String(cred.private_key||'').includes('-----BEGIN PRIVATE KEY-----'))
 deny('DEDICATED_TEST_IDENTITY_REQUIRED');
const [{initializeApp,cert},{getAuth},{getFirestore},{default:webpush}]=await Promise.all([
 import('firebase-admin/app'),import('firebase-admin/auth'),
 import('firebase-admin/firestore'),import('web-push')
]);
const app=initializeApp({credential:cert(cred),projectId:PROJECT});
const account=await getAuth(app).getUserByEmail(OWNER);
if(!account?.uid||!account.emailVerified||account.email?.toLowerCase()!==OWNER||
 !account.providerData.some(p=>p.providerId==='google.com'))deny('VERIFIED_ROOT_OWNER_REQUIRED');
const db=getFirestore(app);
const group=db.collection('pushSubscriptions').doc(account.uid).collection('devices');
const snapshot=await group.limit(5).get();
const devices=snapshot.docs.filter(d=>!d.id.startsWith('probe_'));
if(devices.length!==1)deny('EXPECT_EXACTLY_ONE_REAL_OWNER_IPHONE_GOT_'+devices.length);
const record=devices[0].data();
const endpoint=record?.endpoint;
let url;
try{url=new URL(endpoint)}catch{deny('ENDPOINT_MISSING')}
if(url.protocol!=='https:'||url.hostname!=='web.push.apple.com'||
 url.username||url.password||url.port||!url.pathname.startsWith('/'))
 deny('NOT_APPLE_IPHONE_ENDPOINT');
if(!/^[A-Za-z0-9_-]{40,150}$/.test(String(record?.p256dh||''))||
 !/^[A-Za-z0-9_-]{12,130}$/.test(String(record?.auth||'')))
 deny('NOT_AN_APPLE_SUBSCRIPTION');
if(!record?.createdAt?.toMillis)deny('NOT_SERVER_CONFIRMED_SUBSCRIPTION');
const expires=record.createdAt.toMillis();
if(!Number.isFinite(expires)||expires>Date.now()+60000||
 Date.now()-expires>7*24*60*60*1000)deny('SUBSCRIPTION_OUTSIDE_TEST_WINDOW');
// Fail closed on inconsistent pairing: all recent devices must be the owner,
// verified against the current exact TEST sender VAPID credentials.
webpush.setVapidDetails(process.env.TEST_PUSH_CONTACT,
 process.env.TEST_VAPID_PUBLIC_KEY,process.env.TEST_VAPID_PRIVATE_KEY);
try{
 const response=await webpush.sendNotification({
  endpoint,keys:{p256dh:record.p256dh,auth:record.auth}
 },JSON.stringify({kind:'OWNER_TEST_PUSH_NO_PRIVATE_CONTENT'}),{
  TTL:300,urgency:'normal',timeout:12000
 });
 if(response?.statusCode!==201&&response?.statusCode!==202)
  deny('PUSH_SERVICE_NON_ACCEPTED_STATUS');
 console.log('OWNER_IPHONE_ONE_SHOT_APPLE_PUSH_ACCEPTED_'+response.statusCode);
 console.log('No Firestore changes; no task/note/customer data; recurring sender remains OFF');
}catch(e){
 // Never disclose recipient, URL, tokens, VAPID details or remote response body.
 console.error('OWNER_ONE_SHOT_DELIVERY_HOLD_STATUS_'+(Number(e?.statusCode)||'NETWORK'));
 process.exitCode=1;
}
