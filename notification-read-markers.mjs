// Local, UID-separated notification read markers. Never store task text,
// emails, credentials or subscription secrets. Other devices are independent.
const ID=/^[A-Za-z0-9_-]{1,150}$/;
const KEY_PREFIX='honbin_cloud_notice_read_v1_';
export function notificationReadMarkers({storage,uid}){
 if(!storage||!ID.test(uid))throw Error('NOTIFICATION_READ_CONTEXT_REQUIRED');
 const key=KEY_PREFIX+uid;
 let seen=new Set();
 try{
  const raw=JSON.parse(storage.getItem(key)||'[]');
  if(Array.isArray(raw))seen=new Set(raw.filter(x=>typeof x==='string'&&
   x.length<=500&&!/[<>]/.test(x)).slice(-400));
 }catch{seen=new Set()}
 const persist=()=>{
  const tail=[...seen].slice(-400);seen=new Set(tail);
  try{storage.setItem(key,JSON.stringify(tail));return true}catch{return false}
 };
 return Object.freeze({
  isRead:id=>seen.has(id),
  mark:id=>{if(typeof id!=='string'||id.length>500)throw Error('INVALID_NOTICE_ID');
   seen.delete(id);seen.add(id);return persist()},
  markAll:ids=>{if(!Array.isArray(ids))throw Error('INVALID_NOTICE_IDS');
   for(const id of ids){if(typeof id!=='string'||id.length>500)throw Error('INVALID_NOTICE_ID');
    seen.delete(id);seen.add(id)}return persist()},
  countUnread:items=>items.filter(item=>!seen.has(item.id)).length
 });
}
