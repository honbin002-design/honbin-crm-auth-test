// TEST-only opt-in Web Push client. Import has no side effects.
// Deliberately not called by workspace until backend + Rules pass live tests.
// No VAPID private key or service account secret is ever sent to browsers.
const ID=/^[A-Za-z0-9_-]{1,100}$/;
const b64urlToBytes=value=>{
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{40,200}$/.test(value))
  throw Error('INVALID_PUBLIC_VAPID_KEY');
 const base64=value.replace(/-/g,'+').replace(/_/g,'/');
 const binary=atob(base64+'='.repeat((4-base64.length%4)%4));
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
};
export function pushSubscriptionService({db,sdk,currentUid,registration,publicVapidKey,
  notification,deviceId}){
 if(!db||!sdk||typeof currentUid!=='function'||!registration?.pushManager||
  !notification||!ID.test(deviceId))throw Error('PUSH_CONTEXT_REQUIRED');
 const {doc,getDoc,setDoc,deleteDoc,serverTimestamp}=sdk;
 if(![doc,getDoc,setDoc,deleteDoc,serverTimestamp].every(f=>typeof f==='function'))
  throw Error('PUSH_SDK_REQUIRED');
 const uid=()=>{const value=currentUid();if(typeof value!=='string'||!ID.test(value))
  throw Error('NOT_AUTHENTICATED');return value};
 const ref=user=>doc(db,'pushSubscriptions',user,'devices',deviceId);
 // Must only be invoked by an explicit tap AFTER TEST backend is enabled.
 async function enableFromUserGesture(){
  const user=uid();
  if(notification.permission==='denied')throw Error('PUSH_PERMISSION_DENIED');
  const permission=await notification.requestPermission();
  if(permission!=='granted')throw Error('PUSH_PERMISSION_NOT_GRANTED');
  if(uid()!==user)throw Error('ACCOUNT_CHANGED');
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({
   userVisibleOnly:true,applicationServerKey:b64urlToBytes(publicVapidKey)
  });
  if(uid()!==user)throw Error('ACCOUNT_CHANGED');
  const json=subscription.toJSON();
  if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth)
   throw Error('PUSH_SUBSCRIPTION_INCOMPLETE');
  const key=ref(user);
  const existing=await getDoc(key);
  if(uid()!==user)throw Error('ACCOUNT_CHANGED');
  await setDoc(key,{
   endpoint:json.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth,
   createdAt:existing.exists()?existing.data().createdAt:serverTimestamp(),
   updatedAt:serverTimestamp()
  });
  if(uid()!==user)throw Error('ACCOUNT_CHANGED');
  return {enabled:true};
 }
 async function disable(){
  const user=uid();
  await deleteDoc(ref(user));
  if(uid()!==user)throw Error('ACCOUNT_CHANGED');
  // A device may have other app accounts; do not globally unsubscribe.
  return {enabled:false};
 }
 return Object.freeze({enableFromUserGesture,disable});
}
