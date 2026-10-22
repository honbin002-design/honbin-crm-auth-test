// One-time live event payload acceptance gate. No Firestore mutations.
// Scope: ONE active "鴻繽" notebook, one approved owner or distinct EDITOR,
// exactly one currently enrolled Apple iPhone, one existing fresh event.
// Never disclose email, UID, endpoint, group/item IDs or secrets in logs.
import {createHash} from 'node:crypto';
import {routeNotification} from './notification-recipient-router.mjs';
import {notificationEventStillRelevant} from './notification-event-freshness.mjs';
const PROJECT='honbin-crm-notes-spark',OWNER_EMAIL='honbin002@gmail.com';
const SECOND_HASH='68cc7610f58341fe00bd8b1161b5bb0ceb0a6e7137a9b4ea83ed977a536f5eca';
const SERVICE='honbin-test-push-sender@'+PROJECT+'.iam.gserviceaccount.com';
const PUB='BKK0gtCmZKxUCBBpZvuik5z8I4ogHXrVEPsVurnxE9bObfmXEmTw-wIBCePf_hSieDNPqBoJ-62q2MyK-0VtaJE';
const stop=x=>{throw Error('ONE_REAL_EVENT_SAFE_HOLD_'+x)};
if(process.env.TEST_PUSH_SEND_ENABLED==='EXPLICITLY_APPROVED')stop('PERIODIC_SENDER_MUST_STAY_OFF');
if(process.env.REAL_EVENT_ONE_SHOT_APPROVED!=='yes')stop('NO_SCOPED_TEST_APPROVAL');
for(const key of ['TEST_FIREBASE_SERVICE_ACCOUNT_JSON','TEST_VAPID_PUBLIC_KEY',
 'TEST_VAPID_PRIVATE_KEY','TEST_PUSH_CONTACT'])if(!process.env[key])stop('SECRET_MISSING');
if(process.env.TEST_VAPID_PUBLIC_KEY!==PUB)stop('PUBLIC_VAPID_NOT_MATCHED');
if(!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.TEST_PUSH_CONTACT))
 stop('INVALID_VAPID_CONTACT');
let c;try{c=JSON.parse(process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON)}catch{stop('INVALID_CREDENTIAL')}
if(c.type!=='service_account'||c.project_id!==PROJECT||c.client_email!==SERVICE||
 !String(c.private_key||'').includes('-----BEGIN PRIVATE KEY-----'))
 stop('DEDICATED_SENDER_IDENTITY_MISMATCH');
const [{initializeApp,cert,deleteApp},{getAuth},{getFirestore},{default:webpush}]=await Promise.all([
 import('firebase-admin/app'),import('firebase-admin/auth'),
 import('firebase-admin/firestore'),import('web-push')]);
const app=initializeApp({projectId:PROJECT,credential:cert(c)});
let sends=0;
try{
 const auth=getAuth(app),db=getFirestore(app);
 const owner=await auth.getUserByEmail(OWNER_EMAIL);
 if(!owner.emailVerified||!owner.providerData?.some(p=>p.providerId==='google.com'))
  stop('ROOT_IDENTITY_NOT_VERIFIED');
 const users=await auth.listUsers(30);
 if(users.pageToken)stop('TOO_MANY_AUTH_ACCOUNTS');
 const possible=users.users.filter(u=>u.uid!==owner.uid&&u.emailVerified&&u.email&&
  u.providerData?.some(p=>p.providerId==='google.com')&&
  createHash('sha256').update(u.email.toLowerCase()).digest('hex')===SECOND_HASH);
 if(possible.length!==1)stop('DISTINCT_SECOND_IDENTITY_NOT_CONFIRMED');
 const second=possible[0];
 const approved=await db.collection('approvedAccounts').doc(second.email.toLowerCase()).get();
 if(!approved.exists||approved.data().email!==second.email.toLowerCase()||
  approved.data().status!=='ACTIVE')stop('SECOND_ACCOUNT_NOT_APPROVED');
 const idx=await db.collection('users').doc(owner.uid).collection('groupIndex').limit(11).get();
 if(idx.size>10)stop('TOO_MANY_OWNER_GROUPS');
 const matching=[];
 for(const pointer of idx.docs){
  const found=await db.collection('groups').doc(pointer.id).get();
  if(found.exists&&found.data().name==='鴻繽'&&found.data().ownerUid===owner.uid&&
   !found.data().deleteState)matching.push(found);
 }
 if(matching.length!==1)stop('PRIMARY_NOTEBOOK_NOT_UNIQUE_ACTIVE');
 const group=matching[0],gid=group.id;
 const batch=await group.ref.collection('members').limit(13).get();
 if(batch.size>12)stop('MEMBERSHIP_OVER_LIMIT');
 const members=batch.docs.map(x=>({uid:x.id,...x.data()}));
 const secondMember=members.find(x=>x.uid===second.uid);
 if(!secondMember||secondMember.status!=='ACTIVE'||secondMember.role!=='EDITOR')
  stop('SECOND_NO_LONGER_ACTIVE_EDITOR');
 const active=new Set([owner.uid,...members.filter(x=>x.status==='ACTIVE'&&
  ['ADMIN','EDITOR','VIEWER'].includes(x.role)).map(x=>x.uid)]);
 const preferred=[second.uid,owner.uid];
 const choices=[];
 for(const stream of [
  {kind:'TASK_COMPLETED',folder:'tasks',field:'completedAt'},
  {kind:'TASK_ASSIGNED',folder:'tasks',field:'createdAt'},
  {kind:'SHARED_NOTE_CREATED',folder:'notes',field:'createdAt'}]){
  const list=await group.ref.collection(stream.folder)
   .orderBy(stream.field,'desc').limit(5).get();
  for(const doc of list.docs){
   const at=doc.get(stream.field)?.toMillis?.();
   if(!Number.isFinite(at)||at>Date.now()+60000||
      at<Date.now()-12*3600*1000)continue;
   let event;try{event=routeNotification({
    kind:stream.kind,group:{id:gid,...group.data()},members,
    itemId:doc.id,record:doc.data()
   })}catch{continue}
   if(!active.has(event.actorUid))continue;
   for(const uid of preferred){
    if(!event.recipients.includes(uid)||!active.has(uid))continue;
    if(!notificationEventStillRelevant(event,doc.data(),uid))continue;
    choices.push({uid,event,at,stream});
   }
  }
 }
 if(!choices.length)stop('NO_VALID_RECENT_EVENT_FOR_TWO_VERIFIED_PHONES');
 // Prefer the distinct member's iPhone, then the original owner's iPhone.
 choices.sort((a,b)=>preferred.indexOf(a.uid)-preferred.indexOf(b.uid)||b.at-a.at);
 const selected=choices[0];
 const target=selected.uid===owner.uid?owner:second;
 // Re-read ACTIVE group, recipient, actor and event immediately before send.
 const currentGroup=await group.ref.get();
 if(!currentGroup.exists||currentGroup.data().deleteState||
    currentGroup.data().ownerUid!==owner.uid)stop('NOTEBOOK_STATE_CHANGED');
 async function stillActive(uid){
  if(uid===owner.uid)return true;
  const p=await group.ref.collection('members').doc(uid).get();
  return p.exists&&p.data().uid===uid&&p.data().status==='ACTIVE'&&
   ['ADMIN','EDITOR','VIEWER'].includes(p.data().role);
 }
 if(!await stillActive(selected.uid)||!await stillActive(selected.event.actorUid))
  stop('MEMBERSHIP_REVOKED_BEFORE_SEND');
 const docref=group.ref.collection(selected.stream.folder).doc(
  selected.stream.kind==='SHARED_NOTE_CREATED'?
   selected.event.payload.noteId:selected.event.payload.taskId);
 const fresh=await docref.get();
 if(!fresh.exists||!notificationEventStillRelevant(selected.event,fresh.data(),selected.uid))
  stop('EVENT_BECAME_STALE_BEFORE_SEND');
 const devices=await db.collection('pushSubscriptions').doc(target.uid).collection('devices').limit(5).get();
 const registered=devices.docs.filter(x=>!x.id.startsWith('probe_'));
 if(registered.length!==1||devices.size>4)stop('EXACTLY_ONE_VERIFIED_IPHONE_REQUIRED');
 const device=registered[0].data();
 let endpoint;try{endpoint=new URL(device.endpoint)}catch{stop('INVALID_WEBPUSH_ENDPOINT')}
 if(endpoint.protocol!=='https:'||endpoint.hostname!=='web.push.apple.com'||
  endpoint.username||endpoint.password||endpoint.port||
  !/^[A-Za-z0-9_-]{40,150}$/.test(String(device.p256dh||''))||
  !/^[A-Za-z0-9_-]{12,130}$/.test(String(device.auth||'')))
  stop('NOT_VALID_APPLE_IPHONE_SUBSCRIPTION');
 const at=device.createdAt?.toMillis?.();
 if(!Number.isFinite(at)||at>Date.now()+60000||Date.now()-at>7*24*3600*1000)
  stop('IPHONE_SUBSCRIPTION_NOT_RECENT');
 webpush.setVapidDetails(process.env.TEST_PUSH_CONTACT,
  process.env.TEST_VAPID_PUBLIC_KEY,process.env.TEST_VAPID_PRIVATE_KEY);
 // Payload contains only type, groupId and taskId/noteId; no personal data.
 const payload=selected.event.payload;
 sends++;
 try{
  const sent=await webpush.sendNotification({
   endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}
  },JSON.stringify(payload),{TTL:300,urgency:'normal',timeout:12000});
  if(sent?.statusCode!==201&&sent?.statusCode!==202)
   stop('APPLE_DID_NOT_ACCEPT_PAYLOAD');
  console.log('ONE_REAL_EVENT_APPLE_ACCEPTED_'+sent.statusCode);
  console.log('ONE_REAL_EVENT_KIND_'+selected.event.payload.kind);
  console.log('ONE_REAL_EVENT_TARGET_'+(selected.uid===second.uid?'SECOND_EDITOR':'ORIGINAL_OWNER'));
  console.log('ONE_REAL_EVENT_SENT_MAX_ONE_NO_FIRESTORE_WRITES');
 }catch(error){
  console.error('ONE_REAL_EVENT_DELIVERY_HOLD_STATUS_'+(Number(error?.statusCode)||'NETWORK'));
  process.exitCode=2;
 }
}catch(error){
 console.error('ONE_REAL_EVENT_STOP_'+(String(error?.message||'').startsWith('ONE_REAL_EVENT_SAFE_HOLD_')?
  String(error.message).replace('ONE_REAL_EVENT_SAFE_HOLD_',''):'VERIFY_OR_READ_FAILURE'));
 process.exitCode=2;
}finally{
 await deleteApp(app);
 if(sends>1)throw Error('UNEXPECTED_DELIVERY_COUNT');
}
