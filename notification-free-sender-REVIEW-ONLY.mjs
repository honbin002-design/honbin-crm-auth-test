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
 const [{default:admin},{default:webpush}]=await Promise.all([
  import('firebase-admin'),import('web-push')
 ]);
 admin.initializeApp({credential:admin.credential.cert(credential),projectId:PROJECT});
 const db=admin.firestore(),auth=admin.auth();
 webpush.setVapidDetails(process.env.TEST_PUSH_CONTACT,
  process.env.TEST_VAPID_PUBLIC_KEY,process.env.TEST_VAPID_PRIVATE_KEY);
 const accountCache=new Map();
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
  if(!live.exists)return false;
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
    .collection('devices').get();
   for(const device of devices.docs){
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
     if(data?.status==='SENT'||(data?.status==='SENDING'&&
       now()-(tsMillis(data.claimedAt))<20*60*1000))return false;
     if((data?.attempts||0)>=3)return false;
     tx.set(receipt,{status:'SENDING',eventId:event.eventId,
      recipientUid:uid,deviceId:device.id,claimedAt:admin.firestore.Timestamp.now(),
      attempts:(data?.attempts||0)+1});
     return true;
    });
    if(!claimed)continue;
    try{
     await webpush.sendNotification({
      endpoint:subscription.endpoint,
      keys:{p256dh:subscription.p256dh,auth:subscription.auth}
     },JSON.stringify(event.payload),{TTL:3600,urgency:'normal'});
     await receipt.update({status:'SENT',sentAt:admin.firestore.FieldValue.serverTimestamp()});
    }catch(err){
     const status=Number(err.statusCode)||0;
     await receipt.update({status:'FAILED',failedAt:admin.firestore.FieldValue.serverTimestamp(),
      httpStatus:status});
     if(status===404||status===410){
      const latest=await device.ref.get();
      if(latest.exists&&latest.data().endpoint===subscription.endpoint)
       await device.ref.delete();
     }
     // Do not log endpoint, keys, user email, private message or response body.
     console.error('TEST_PUSH_DELIVERY_FAILED',status||'network');
    }
   }
  }
 }
 const groups=await db.collection('groups').get();
 for(const groupDoc of groups.docs){
  const group={id:groupDoc.id,...groupDoc.data()};
  if(!group.ownerUid)continue;
  const members=(await groupDoc.ref.collection('members').get())
   .docs.map(d=>({uid:d.id,...d.data()}));
  const [tasks,notes]=await Promise.all([
   groupDoc.ref.collection('tasks').get(),groupDoc.ref.collection('notes').get()
  ]);
  for(const doc of tasks.docs){
   const task=doc.data();
   if(doc.createTime?.toMillis()>=activation){
    try{await sendEvent(routeNotification({
     kind:'TASK_ASSIGNED',group,members,itemId:doc.id,record:task
    }))}catch{console.error('TEST_PUSH_ROUTING_SKIP_TASK_CREATE')}
   }
   if(tsMillis(task.completedAt)>=activation){
    try{await sendEvent(routeNotification({
     kind:'TASK_COMPLETED',group,members,itemId:doc.id,record:task
    }))}catch{console.error('TEST_PUSH_ROUTING_SKIP_TASK_DONE')}
   }
  }
  for(const doc of notes.docs){
   const note=doc.data();
   if(doc.createTime?.toMillis()<activation||note.deleted===true)continue;
   try{await sendEvent(routeNotification({
    kind:'SHARED_NOTE_CREATED',group,members,itemId:doc.id,record:note
   }))}catch{console.error('TEST_PUSH_ROUTING_SKIP_SHARED_NOTE')}
  }
 }
 console.log('TEST_PUSH_SENDER_FINISHED_WITHOUT_EXPOSING_RECIPIENT_DATA');
}
main().catch(e=>{
 console.error('TEST_PUSH_SENDER_SAFE_STOP',String(e.message||'unknown'));
 process.exitCode=1;
});
