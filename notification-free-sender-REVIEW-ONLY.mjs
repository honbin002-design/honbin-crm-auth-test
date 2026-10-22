// REVIEW-ONLY TEST sender. NEVER scheduled or deployed until the owner
// approves credential storage, Firestore subscription Rules and end-to-end
// two-account acceptance. No secrets in repo, URLs or push payloads.
import {createHash} from 'node:crypto';
import {routeNotification} from './notification-recipient-router.mjs';
import {notificationEventStillRelevant} from './notification-event-freshness.mjs';
const PROJECT='honbin-crm-notes-spark';
const required=[
 'TEST_FIREBASE_SERVICE_ACCOUNT_JSON','TEST_VAPID_PUBLIC_KEY',
 'TEST_VAPID_PRIVATE_KEY','TEST_PUSH_CONTACT','TEST_PUSH_START_ISO'
];
const now=()=>Date.now();
const appleEndpoint=value=>{
 try{const u=new URL(value);return u.protocol==='https:'&&
  u.hostname==='web.push.apple.com'&&!u.username&&!u.password&&!u.port}
 catch{return false}
};
const digest=value=>createHash('sha256').update(value).digest('hex');
const tsMillis=value=>typeof value?.toMillis==='function'?value.toMillis():0;
async function main(){
 if(process.env.TEST_PUSH_SEND_ENABLED!=='EXPLICITLY_APPROVED'){
  console.log('SAFE_HOLD: push sender disabled; no Firebase connection or delivery');
  return;
 }
 for(const key of required)if(!process.env[key])throw Error('MISSING_SECRET_OR_CONFIG_'+key);
 const activation=Date.parse(process.env.TEST_PUSH_START_ISO);
 if(!Number.isFinite(activation)||activation>now())throw Error('INVALID_ACTIVATION_TIME');
 const credential=JSON.parse(process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON);
 if(credential.project_id!==PROJECT)throw Error('WRONG_FIREBASE_PROJECT_STOP');
 // Never silently use the project's default broad-scope Firebase Admin key.
 // The existing dedicated read-only-verified sender identity is authoritative.
 if(credential.type!=='service_account'||
    credential.client_email!==`honbin-test-push-sender@${PROJECT}.iam.gserviceaccount.com`||
    typeof credential.private_key!=='string'||
    !credential.private_key.includes('-----BEGIN PRIVATE KEY-----'))
  throw Error('DEDICATED_TEST_SENDER_IDENTITY_REQUIRED_STOP');
 const [{initializeApp,cert},{getAuth},{getFirestore,Timestamp,FieldPath,FieldValue},{default:webpush}]=await Promise.all([
  import('firebase-admin/app'),import('firebase-admin/auth'),
  import('firebase-admin/firestore'),import('web-push')
 ]);
 const app=initializeApp({credential:cert(credential),projectId:PROJECT});
 const db=getFirestore(app),auth=getAuth(app);
 webpush.setVapidDetails(process.env.TEST_PUSH_CONTACT,
  process.env.TEST_VAPID_PUBLIC_KEY,process.env.TEST_VAPID_PRIVATE_KEY);
 const accountCache=new Map();
 // Stop before an unexpectedly large group/device set can consume the Spark
 // daily quota. The cursor is only advanced after a whole event completes.
 let deliveriesThisRun=0;
 async function approved(uid){
  if(accountCache.has(uid))return accountCache.get(uid);
  let ok=false;
  try{
   const u=await auth.getUser(uid),email=u.email?.toLowerCase();
   if(u.emailVerified&&email&&u.providerData.some(p=>p.providerId==='google.com')){
    if(email==='honbin002@gmail.com')ok=true;
    else{
     const a=await db.doc('approvedAccounts/'+email).get();
     ok=a.exists&&a.data().email===email&&a.data().status==='ACTIVE';
    }
   }
  }catch{/* Fail closed if auth/approval lookup fails. */}
  accountCache.set(uid,ok);return ok;
 }
 async function stillMember(groupId,uid){
  const groupRef=db.collection('groups').doc(groupId);
  const live=await groupRef.get();
  if(!live.exists||live.data().deleteState)return false;
  if(live.data().ownerUid===uid)return true;
  const member=await groupRef.collection('members').doc(uid).get();
  return member.exists&&member.data().status==='ACTIVE'&&
    ['ADMIN','EDITOR','VIEWER'].includes(member.data().role);
 }
 async function stillRelevant(event,uid){
  const {kind,groupId,taskId,noteId}=event.payload;
  const base=db.collection('groups').doc(groupId);
  const ref=kind==='SHARED_NOTE_CREATED'
   ?base.collection('notes').doc(noteId)
   :base.collection('tasks').doc(taskId);
  const fresh=await ref.get();
  return fresh.exists&&notificationEventStillRelevant(event,fresh.data(),uid);
 }
 async function sendEvent(event){
  for(const uid of event.recipients){
   if(!await approved(uid)||!await stillMember(event.payload.groupId,uid)||
      !await stillRelevant(event,uid))continue;
   const devices=await db.collection('pushSubscriptions').doc(uid)
    .collection('devices').limit(4).get();
   if(devices.size>3)throw Error('PUSH_DEVICE_LIMIT_STOP');
   for(const device of devices.docs){
    // A live ACL probe is a synthetic, never-deliverable entry. Do not send to
    // it even if a network failure prevented the owner-only cleanup.
    if(device.id.startsWith('probe_'))continue;
    if(deliveriesThisRun>=30)throw Error('PUSH_RUN_DELIVERY_BUDGET_STOP');
    // Membership can be revoked while this job is processing other devices.
    if(!await stillMember(event.payload.groupId,uid)||
      !await stillRelevant(event,uid))break;
    const subscription=device.data();
    if(!appleEndpoint(subscription.endpoint)||!subscription.p256dh||
      !subscription.auth)continue;
    const id=digest(event.eventId+':'+uid+':'+device.id);
    const receipt=db.collection('notificationDeliveryLedger').doc(id);
    const claimed=await db.runTransaction(async tx=>{
     const prior=await tx.get(receipt);
     const data=prior.exists?prior.data():null;
     if(data?.status==='SENT')return false;
     if(data?.status==='SENDING'&&now()-(tsMillis(data.claimedAt))<20*60*1000)
      throw Error('PUSH_DELIVERY_IN_PROGRESS_STOP');
     if((data?.attempts||0)>=3)throw Error('PUSH_DELIVERY_RETRIES_EXHAUSTED');
     tx.set(receipt,{status:'SENDING',eventId:event.eventId,
      recipientUid:uid,deviceId:device.id,claimedAt:Timestamp.now(),
      attempts:(data?.attempts||0)+1});
     return true;
    });
    if(!claimed)continue;
    deliveriesThisRun++;
    try{
     await webpush.sendNotification({
      endpoint:subscription.endpoint,
      keys:{p256dh:subscription.p256dh,auth:subscription.auth}
     },JSON.stringify(event.payload),{TTL:3600,urgency:'normal'});
     await receipt.update({status:'SENT',sentAt:FieldValue.serverTimestamp()});
    }catch(err){
     const status=Number(err.statusCode)||0;
     await receipt.update({status:'FAILED',failedAt:FieldValue.serverTimestamp(),
      httpStatus:status});
     if(status===404||status===410){
      const latest=await device.ref.get();
      if(latest.exists&&latest.data().endpoint===subscription.endpoint)
       await device.ref.delete();
     }
     // Do not log endpoint, keys, user email, private message or response body.
     console.error('TEST_PUSH_DELIVERY_FAILED',status||'network');
     if(status!==404&&status!==410)throw Error('RETRYABLE_PUSH_DELIVERY_FAILED');
    }
   }
  }
 }
 // Three global streams read only new records. The saved document cursor
 // prevents every scheduled run from rereading all historical notes/tasks.
 // At most 40 events per stream are processed in a run; backlog rolls forward
 // on the next run. Collection-group indexes must be reviewed before enabling.
 const streams=[
  {kind:'TASK_ASSIGNED',collection:'tasks',field:'createdAt'},
  {kind:'TASK_COMPLETED',collection:'tasks',field:'completedAt'},
  {kind:'SHARED_NOTE_CREATED',collection:'notes',field:'createdAt'}
 ];
 for(const stream of streams){
  const checkpoint=db.collection('notificationSenderCursors').doc(stream.kind);
  const last=await checkpoint.get();
  if(last.exists&&last.data().activation!==process.env.TEST_PUSH_START_ISO)
   throw Error('PUSH_CURSOR_ACTIVATION_CHANGED_STOP');
  let query=db.collectionGroup(stream.collection)
   .where(stream.field,'>=',Timestamp.fromMillis(activation))
   .orderBy(stream.field,'asc')
   .orderBy(FieldPath.documentId(),'asc').limit(40);
  if(last.exists){
   const {path,time}=last.data();
   if(typeof path!=='string'||!/^groups\/[A-Za-z0-9_-]+\/(tasks|notes)\/[A-Za-z0-9_-]+$/.test(path)||
      typeof time?.toMillis!=='function'||time.toMillis()<activation)
    throw Error('INVALID_PUSH_CURSOR_STOP');
   // Store the ordered values. A later deletion of the processed document
   // must not strand the cursor or force a scan of the historical backlog.
   query=query.startAfter(time,db.doc(path));
  }
  const batch=await query.get();
  for(const doc of batch.docs){
   const groupRef=doc.ref.parent.parent;
   if(!groupRef||groupRef.parent.id!=='groups')throw Error('INVALID_EVENT_PATH');
   const live=await groupRef.get();
   if(live.exists){
    const group={id:groupRef.id,...live.data()};
    const memberBatch=await groupRef.collection('members').limit(31).get();
    if(memberBatch.size>30)throw Error('PUSH_GROUP_MEMBER_LIMIT_STOP');
    const members=memberBatch.docs.map(d=>({uid:d.id,...d.data()}));
    let event;
    try{event=routeNotification({kind:stream.kind,group,members,
      itemId:doc.id,record:doc.data()})}catch{
     // Invalid/deleted state has no recipient; retain no private payload.
     console.error('TEST_PUSH_EVENT_SKIPPED',stream.kind);
    }
    if(event)await sendEvent(event);
   }
   const time=doc.get(stream.field);
   if(typeof time?.toMillis!=='function'||time.toMillis()<activation)
    throw Error('INVALID_EVENT_TIME_STOP');
   await checkpoint.set({activation:process.env.TEST_PUSH_START_ISO,
    path:doc.ref.path,time,scannedAt:FieldValue.serverTimestamp()});
  }
 }
 console.log('TEST_PUSH_SENDER_FINISHED_WITHOUT_EXPOSING_RECIPIENT_DATA');
}
main().catch(e=>{
 console.error('TEST_PUSH_SENDER_SAFE_STOP',String(e.message||'unknown'));
 process.exitCode=1;
});
