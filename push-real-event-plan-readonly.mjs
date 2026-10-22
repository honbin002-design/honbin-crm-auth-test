// One-run, live Firebase event-plan audit. READ-ONLY; no push delivery,
// cursor writes, ledger writes or PII in output.
import {routeNotification} from './notification-recipient-router.mjs';
import {notificationEventStillRelevant} from './notification-event-freshness.mjs';
const PROJECT='honbin-crm-notes-spark';
const OWNER_EMAIL='honbin002@gmail.com';
const SERVICE='honbin-test-push-sender@'+PROJECT+'.iam.gserviceaccount.com';
const stop=reason=>{throw Error('PUSH_EVENT_READONLY_HOLD_'+reason)};
if(process.env.TEST_PUSH_SEND_ENABLED==='EXPLICITLY_APPROVED')stop('AUTOSENDER_MUST_REMAIN_OFF');
let credential;
try{credential=JSON.parse(process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON||'')}
catch{stop('INVALID_OR_MISSING_CREDENTIAL')}
if(credential.project_id!==PROJECT||credential.client_email!==SERVICE||
 credential.type!=='service_account'||!credential.private_key?.includes('-----BEGIN PRIVATE KEY-----'))
 stop('NOT_DEDICATED_TEST_SERVICE_IDENTITY');
const [{initializeApp,cert,deleteApp},{getAuth},{getFirestore}]=await Promise.all([
 import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/firestore')]);
const app=initializeApp({projectId:PROJECT,credential:cert(credential)});
const counts={notebooks:0,readEvents:0,routable:0,liveEligibleRecipientPairs:0,
 authorizedMemberPairs:0,unapprovedOrRevokedPairs:0,notRelevantPairs:0,
 invalidOrStaleEvents:0,disabledGroupEvents:0,streamReadFailures:0};
try{
 const db=getFirestore(app),auth=getAuth(app);
 const owner=await auth.getUserByEmail(OWNER_EMAIL);
 if(!owner?.uid||!owner.emailVerified||!owner.providerData?.some(p=>p.providerId==='google.com'))
  stop('OWNER_UNVERIFIED');
 const idx=await db.collection('users').doc(owner.uid).collection('groupIndex').limit(11).get();
 if(idx.size>10)stop('GROUP_COUNT_OVER_LIMIT');
 const groups=[];
 for(const ptr of idx.docs){
  const group=await db.collection('groups').doc(ptr.id).get();
  if(group.exists&&group.data().name==='鴻繽'&&
     group.data().ownerUid===owner.uid)groups.push(group);
 }
 counts.notebooks=groups.length;
 if(groups.length!==1)stop('EXPECTED_ONE_PRIMARY_NOTEBOOK');
 const group=groups[0],data=group.data(),gid=group.id;
 if(data.deleteState)stop('PRIMARY_NOTEBOOK_RETIRED');
 const m=await group.ref.collection('members').limit(13).get();
 if(m.size>12)stop('MEMBER_COUNT_OVER_LIMIT');
 const members=m.docs.map(x=>({uid:x.id,...x.data()}));
 const active=new Set([owner.uid,...members.filter(x=>x.status==='ACTIVE'&&
  ['EDITOR','ADMIN','VIEWER'].includes(x.role)).map(x=>x.uid)]);
 async function stillAllowed(uid){
  if(!active.has(uid))return false;
  if(uid===owner.uid)return true;
  const user=await auth.getUser(uid),email=user.email?.toLowerCase();
  if(!user.emailVerified||!email||!user.providerData?.some(p=>p.providerId==='google.com'))return false;
  const app=await db.collection('approvedAccounts').doc(email).get();
  return app.exists&&app.data()?.email===email&&app.data()?.status==='ACTIVE';
 }
 const streams=[
  {kind:'TASK_ASSIGNED',folder:'tasks',field:'createdAt'},
  {kind:'TASK_COMPLETED',folder:'tasks',field:'completedAt'},
  {kind:'SHARED_NOTE_CREATED',folder:'notes',field:'createdAt'}
 ];
 // Accept a small existing history as READ-ONLY evidence; never send old events.
 for(const stream of streams){
  let results;
  try{results=await group.ref.collection(stream.folder)
   .orderBy(stream.field,'desc').limit(5).get()}
  catch{counts.streamReadFailures++;continue}
  for(const doc of results.docs){
   counts.readEvents++;
   const eventDate=doc.get(stream.field)?.toMillis?.();
   if(!Number.isFinite(eventDate)||eventDate>Date.now()+60000){
    counts.invalidOrStaleEvents++;continue
   }
   let planned;
   try{planned=routeNotification({
    kind:stream.kind,group:{id:gid,...data},members,itemId:doc.id,
    record:doc.data()
   })}catch{counts.invalidOrStaleEvents++;continue}
   counts.routable++;
   if(data.deleteState){counts.disabledGroupEvents++;continue}
   for(const uid of planned.recipients){
    if(!active.has(uid)||!active.has(planned.actorUid)){
     counts.unapprovedOrRevokedPairs++;continue
    }
    counts.authorizedMemberPairs++;
    if(!notificationEventStillRelevant(planned,doc.data(),uid)){
     counts.notRelevantPairs++;continue
    }
    if(!await stillAllowed(uid)||!await stillAllowed(planned.actorUid)){
     counts.unapprovedOrRevokedPairs++;continue
    }
    counts.liveEligibleRecipientPairs++;
   }
  }
 }
 for(const [name,value] of Object.entries(counts))
  console.log('PUSH_EVENT_READONLY_'+name.toUpperCase()+'_'+value);
 if(counts.streamReadFailures)process.exitCode=2;
 else console.log('PUSH_EVENT_READONLY_ROUTING_CHECK_PASS_NO_SEND_NO_WRITES');
}catch(err){
 console.error('PUSH_EVENT_READONLY_STOP_'+
  (/permission-denied/.test(String(err?.code))?'FIRESTORE_ACL_DENIED':
  String(err?.message||'').startsWith('PUSH_EVENT_READONLY_HOLD_')?
    String(err.message).replace('PUSH_EVENT_READONLY_HOLD_',''):'SERVER_READ_ERROR'));
 process.exitCode=2;
}finally{await deleteApp(app)}
