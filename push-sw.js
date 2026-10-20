// Isolated TEST Push Service Worker. No Firebase, auth, secrets or caching.
// Only the future authenticated sender may address this subscription.
const APP_PATH='/honbin-crm-auth-test/workspace-v2.html';
const SAME_SCOPE='/honbin-crm-auth-test/';
const idOkay=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(id);
const parse=data=>{
 if(!data)return null;
 try{
  const p=data.json(),kind=p?.kind;
  if(!['TASK_ASSIGNED','TASK_COMPLETED','SHARED_NOTE_CREATED'].includes(kind)
     ||!idOkay(p.groupId))return null;
  const item=kind==='SHARED_NOTE_CREATED'?p.noteId:p.taskId;
  if(!idOkay(item))return null;
  // We intentionally do not put customer names, private task content,
  // member email or UID on an unlocked device's notification surface.
  const params=new URLSearchParams({tab:kind==='SHARED_NOTE_CREATED'?'Notes':'Tasks',
     groupId:p.groupId});
  params.set(kind==='SHARED_NOTE_CREATED'?'noteId':'taskId',item);
  const url=APP_PATH+'?'+params.toString();
  const title=kind==='TASK_ASSIGNED'?'有新任務指派':
    kind==='TASK_COMPLETED'?'指定任務已完成':'共用記事有新內容';
  const body=kind==='TASK_COMPLETED'?'點擊查看完成紀錄':'點擊開啟鴻繽記事與任務';
  return {title,body,url,tag:kind+':'+p.groupId+':'+item};
 }catch{return null}
};
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 // Apple requires every delivered push to show a user-visible notification.
 const payload=parse(event.data);
 event.waitUntil(self.registration.showNotification(
  payload?.title||'鴻繽記事與任務有新通知',
  {body:payload?.body||'點擊開啟 App 查看最新訊息',
   tag:payload?.tag||'honbin-test-update',
   data:{url:payload?.url||APP_PATH},
   icon:SAME_SCOPE+'pwa-icon.svg',badge:SAME_SCOPE+'pwa-icon.svg'}
 ));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const candidate=event.notification.data?.url;
 const target=(typeof candidate==='string'&&candidate.startsWith(APP_PATH)
   &&(candidate.length===APP_PATH.length||candidate[APP_PATH.length]==='?'))
  ?candidate:APP_PATH;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   const url=new URL(client.url);
   if(url.origin===self.location.origin&&url.pathname===APP_PATH){
    if('navigate' in client)await client.navigate(target);
    await client.focus();return;
   }
  }
  if(self.clients.openWindow)await self.clients.openWindow(target);
 })());
});
