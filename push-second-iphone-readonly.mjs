// Read-only private acceptance gate for the SECOND iPhone.
// No push, Firestore writes, credentials printed, user identifiers or emails logged.
const PROJECT='honbin-crm-notes-spark';
const OWNER='honbin002@gmail.com';
const SENDER='honbin-test-push-sender@'+PROJECT+'.iam.gserviceaccount.com';
const fail=code=>{throw Error('SECOND_IPHONE_SAFE_HOLD_'+code)};
if(process.env.TEST_PUSH_SEND_ENABLED==='EXPLICITLY_APPROVED')
 fail('AUTOMATED_SENDER_UNEXPECTEDLY_ON');
const raw=process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON;
if(!raw)fail('MISSING_CREDENTIAL');
let creds;try{creds=JSON.parse(raw)}catch{fail('INVALID_CREDENTIAL_JSON')}
if(creds.type!=='service_account'||creds.project_id!==PROJECT||creds.client_email!==SENDER||
  !String(creds.private_key||'').includes('-----BEGIN PRIVATE KEY-----'))
 fail('DEDICATED_SENDER_IDENTITY_REQUIRED');
const [{initializeApp,cert,deleteApp},{getAuth},{getFirestore}]=await Promise.all([
 import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/firestore')
]);
const app=initializeApp({credential:cert(creds),projectId:PROJECT});
const auth=getAuth(app),db=getFirestore(app);
try{
 const first=await auth.getUserByEmail(OWNER);
 if(!first?.uid||!first.emailVerified||!first.providerData?.some(p=>p.providerId==='google.com'))
  fail('OWNER_REFERENCE_NOT_VERIFIED');
 const users=await auth.listUsers(30);
 if(users.pageToken)fail('AUTH_ACCOUNTS_OVER_SCAN_LIMIT');
 let ownerDevices=0,nonOwnerRegistered=0,secondCandidates=0,approvedSecond=0,pendingApproval=0,tooOld=0;
 for(const user of users.users){
  if(!user.emailVerified||!user.email||
    !user.providerData?.some(p=>p.providerId==='google.com'))continue;
  // Bounded at most 4 devices per user, 30 Firebase users max.
  const snap=await db.collection('pushSubscriptions').doc(user.uid).collection('devices').limit(5).get();
  const real=snap.docs.filter(d=>!d.id.startsWith('probe_'));
  if(real.length>3)fail('EXCESSIVE_DEVICE_REGISTRATIONS');
  if(user.uid===first.uid){ownerDevices=real.length;continue}
  if(!real.length)continue;
  nonOwnerRegistered++;
  for(const device of real){
   let url;try{url=new URL(device.data()?.endpoint)}catch{fail('BAD_SUBSCRIPTION_ENDPOINT')}
   if(url.protocol!=='https:'||url.hostname!=='web.push.apple.com'||
    url.username||url.password||url.port)fail('BAD_APPLE_SUBSCRIPTION_ENDPOINT');
   if(typeof device.data()?.createdAt?.toMillis!=='function')fail('MISSING_SERVER_TIMESTAMP');
   if(device.data().createdAt.toMillis()<Date.parse('2026-10-22T12:20:00Z')){
    tooOld++;continue
   }
   secondCandidates++;
  }
  const record=await db.doc('approvedAccounts/'+user.email.toLowerCase()).get();
  if(record.exists&&record.data()?.status==='ACTIVE'&&record.data()?.email===user.email.toLowerCase())
   approvedSecond++;
  else pendingApproval++;
 }
 console.log('OWNER_SUBSCRIPTION_DEVICE_COUNT_'+ownerDevices);
 console.log('OTHER_AUTHENTICATED_ACCOUNTS_WITH_DEVICES_'+nonOwnerRegistered);
 console.log('NEW_SECOND_IPHONE_SUBSCRIPTIONS_'+secondCandidates);
 console.log('APPROVED_SECOND_ACCOUNTS_'+approvedSecond);
 if(tooOld)console.log('OLDER_OTHER_DEVICES_'+tooOld);
 if(pendingApproval)console.log('SECOND_MEMBER_APPROVAL_NEEDED_COUNT_'+pendingApproval);
 const ready=ownerDevices>=1&&nonOwnerRegistered===1&&secondCandidates===1&&approvedSecond===1&&pendingApproval===0;
 console.log(ready?'SECOND_IPHONE_DISTINCT_APPROVED_IDENTITY_READBACK_PASS':'SECOND_IPHONE_DISTINCT_IDENTITY_OR_APPROVAL_SAFE_HOLD');
 if(!ready)process.exitCode=2;
}finally{await deleteApp(app)}
