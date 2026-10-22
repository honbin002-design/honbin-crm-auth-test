// Secure bridge between the installed CRM PWA and its authenticated
// same-origin Firebase iframe. No admin credentials or VAPID private key.
const ID=/^[A-Za-z0-9_-]{1,120}$/;
const KEY=/^[A-Za-z0-9_-]{8,256}$/;
const allowedEndpoint=subscription=>{
 try{
  const u=new URL(subscription?.endpoint||'');
  return u.protocol==='https:'&&u.hostname==='web.push.apple.com'&&
   !u.username&&!u.password&&!u.port&&
   typeof subscription.keys?.p256dh==='string'&&KEY.test(subscription.keys.p256dh)&&
   typeof subscription.keys?.auth==='string'&&KEY.test(subscription.keys.auth);
 }catch{return false}
};
export function attachInstalledCRMPushBridge({db,sdk,currentUid,authenticated,
 storage=localStorage,onStatus=()=>{},win=window}){
 if(!db||!sdk||typeof currentUid!=='function'||typeof authenticated!=='function'||
  !storage||typeof onStatus!=='function')throw Error('PUSH_BRIDGE_CONTEXT_REQUIRED');
 for(const method of ['doc','getDocFromServer','setDoc','serverTimestamp'])
  if(typeof sdk[method]!=='function')throw Error('PUSH_BRIDGE_SDK_MISSING_'+method);
 const accountDeviceId=uid=>{
  const key='honbin_push_device_id_v1_'+uid;
  let value=storage.getItem(key);
  if(value&&!ID.test(value))throw Error('INVALID_DEVICE_IDENTIFIER');
  if(!value){
   if(typeof win.crypto?.randomUUID!=='function')throw Error('DEVICE_RANDOM_UNAVAILABLE');
   value='iphone_'+win.crypto.randomUUID().replace(/-/g,'');
   storage.setItem(key,value);
  }
  return value;
 };
 const handler=async event=>{
  const msg=event.data;
  if(event.origin!==win.location.origin||event.source!==win.parent||
   win.parent===win||!msg||msg.type!=='HONBIN_HOST_PUSH_SUBSCRIPTION'||
   typeof msg.requestId!=='string'||!ID.test(msg.requestId))return;
  const respond=success=>event.source.postMessage({
   type:'HONBIN_PUSH_SUBSCRIPTION_RESULT',requestId:msg.requestId,success
  },event.origin);
  try{
   // Strictly opt-in only from our approved CRM shell; no external frame
   // may instruct the authenticated child to store device credentials.
   const parentPath=win.parent.location.pathname;
   if(!parentPath.startsWith('/-hongbin-personal-crm-beta/'))throw Error('INVALID_CRM_PARENT');
   if(!authenticated())throw Error('GOOGLE_LOGIN_REQUIRED');
   const uid=currentUid();
   if(!ID.test(uid))throw Error('INVALID_AUTH_UID');
   if(!allowedEndpoint(msg.subscription))throw Error('INVALID_PUSH_SUBSCRIPTION');
   const configResponse=await win.fetch('/-hongbin-personal-crm-beta/push-public-config.json',
     {cache:'no-store'});
   if(!configResponse.ok)throw Error('PUSH_CONFIG_UNAVAILABLE');
   const config=await configResponse.json();
   if(config.subscriptionsEnabled!==true||config.senderEnabled!==true||
      typeof config.publicVapidKey!=='string'||config.publicVapidKey.length<80)
     throw Error('PUSH_NOT_ACTIVATED');
   if(!authenticated()||currentUid()!==uid)throw Error('ACCOUNT_CHANGED');
   const deviceId=accountDeviceId(uid),ref=sdk.doc(db,'pushSubscriptions',uid,'devices',deviceId);
   const old=await sdk.getDocFromServer(ref);
   if(old.metadata?.fromCache)throw Error('SERVER_CHECK_REQUIRED');
   if(!authenticated()||currentUid()!==uid)throw Error('ACCOUNT_CHANGED');
   const record={
    endpoint:msg.subscription.endpoint,
    p256dh:msg.subscription.keys.p256dh,
    auth:msg.subscription.keys.auth,
    createdAt:old.exists()?old.data().createdAt:sdk.serverTimestamp(),
    updatedAt:sdk.serverTimestamp()
   };
   await sdk.setDoc(ref,record);
   if(!authenticated()||currentUid()!==uid)throw Error('ACCOUNT_CHANGED');
   const verified=await sdk.getDocFromServer(ref);
   if(verified.metadata?.fromCache||!verified.exists()||
      verified.data().endpoint!==record.endpoint||
      verified.data().p256dh!==record.p256dh||
      verified.data().auth!==record.auth)throw Error('SUBSCRIPTION_NOT_CONFIRMED');
   respond(true);
   onStatus('iPhone 系統推播訂閱已經通過伺服器核對。');
  }catch(error){
   respond(false);
   onStatus('iPhone 系統推播訂閱未完成：'+String(error?.code||error?.message||error));
  }
 };
 win.addEventListener('message',handler);
 return ()=>win.removeEventListener('message',handler);
}
