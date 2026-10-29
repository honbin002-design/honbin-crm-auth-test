import {notificationSource,notificationTitle} from './firebase-inapp-notifications.mjs?v=20261029-parallel-read';
import {notificationReadMarkers} from './notification-read-markers.mjs';
// All data flows through signed-in Firestore's server-authorized group queries.
// This is a foreground inbox, NOT a claim of lock-screen background delivery.
export function cloudNotificationController({uid,db,sdk,currentUid,getGroups,refreshViews,openItem,storage,onStatus,getCurrentTab,restoreTab,openNotifications,closeNotifications}){
 const $=id=>document.getElementById(id);
 if(!uid||!db||!sdk||typeof currentUid!=='function'||typeof getGroups!=='function'||
  typeof refreshViews!=='function'||typeof openItem!=='function'||!storage)
  throw Error('NOTIFICATION_CONTROLLER_CONTEXT_REQUIRED');
 const source=notificationSource({db,sdk,currentUid,maxGroups:10,size:8});
 const markers=notificationReadMarkers({storage,uid});
 let entries=[],last=0,busy=false,stopped=false,timer=null;
 let returnContext=null,returnElement=null;
 const scroller=()=>{
  if(typeof window==='undefined')return null;
  try{
   if(document.documentElement?.classList?.contains('embedded')&&window.parent!==window&&
      window.parent?.location?.origin===window.location.origin)
     return window.parent;
  }catch{}
  return window;
 };
 const clearReturn=()=>{
  if(returnElement?.parentNode)returnElement.parentNode.removeChild(returnElement);
  returnElement=null;returnContext=null;
 };
 function returnToNotifications(){
  if(!identity()||!returnContext)return false;
  const context=returnContext;
  clearReturn();
  if(typeof openNotifications==='function')openNotifications();
  else if(typeof restoreTab==='function')restoreTab('Notifications');
  $('notificationCenter').hidden=false;
  render();
  const scroll=()=>{
   if(!identity())return;
   const host=scroller();
   if(host?.scrollTo)host.scrollTo({top:context.scrollY,behavior:'instant'});
   else $('notificationOverview').scrollIntoView?.({block:'start'});
  };
  if(typeof requestAnimationFrame==='function')
   requestAnimationFrame(()=>requestAnimationFrame(scroll));
  else scroll();
  return true;
 }
 function showReturnFor(item){
  const attr=item.tab==='Notes'?'noteId':'taskId';
  const listId=item.tab==='Notes'?'notesList':'tasksList';
  const row=item.tab==='Orders'?$('ordersPanel'):
   [...($ (listId).querySelectorAll?.(item.tab==='Notes'?'[data-note-id]':'[data-task-id]')||[])]
    .find(element=>element.dataset?.[attr]===item.itemId);
  if(!row)return false;
  const holder=document.createElement('div');
  holder.className='notification-return-action';
  const button=document.createElement('button');
  button.type='button';button.className='alt';
  button.textContent='← 返回通知';
  button.setAttribute('aria-label','返回訊息通知清單');
  button.onclick=returnToNotifications;
  holder.append(button);
  row.prepend(holder);
  returnElement=holder;
  return true;
 }
 const identity=()=>!stopped&&currentUid()===uid;
 const safeText=value=>String(value??'');
 const setStatus=message=>{$('notificationStatus').textContent=message};
 function render(){
  const unread=markers.countUnread(entries);
  $('notificationCount').hidden=unread===0;
  $('notificationCount').textContent=String(unread);
  const root=$('notificationList');root.replaceChildren();
  if(!entries.length){root.append(document.createTextNode('最近沒有新記事、任務或訂貨通知。'));return}
  for(const item of entries){
   const row=document.createElement('div');row.className='notice-row';
   row.dataset.unread=String(!markers.isRead(item.id));
   const content=document.createElement('div');
   const name=document.createElement('strong');
   name.textContent=(markers.isRead(item.id)?'':'● ')+notificationTitle(item.kind);
   const meta=document.createElement('p');meta.textContent=safeText(item.groupName)+'｜'+
    new Date(item.at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',
     month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
   content.append(name,meta);
   const button=document.createElement('button');button.type='button';
   button.className='alt';button.textContent='查看';
   button.setAttribute('aria-label','查看'+notificationTitle(item.kind));
   button.onclick=async()=>{
    if(!identity())return;
    const host=scroller();
    const previousTab=typeof getCurrentTab==='function'?getCurrentTab():null;
    const returnPoint={previousTab,scrollY:Math.max(0,Number(host?.scrollY)||0)};
    button.disabled=true;
    try{
     const ok=await openItem(item);
     if(!identity())return;
     if(ok){
      clearReturn();
      returnContext=returnPoint;
      if(!showReturnFor(item)){
       // If the target vanished while opening, do not leave the user trapped.
       returnToNotifications();
       onStatus('通知內容已變更，已返回通知清單。');
       return;
      }
      markers.mark(item.id);render();
      $('notificationCenter').hidden=true;
     }
     if(!ok){
      // A missing or revoked item must never strand the member on a
      // half-open detail page without notification navigation.
      if(typeof openNotifications==='function')openNotifications();
      onStatus('通知內容已不存在或暫時無法開啟，已返回通知頁面。');
     }
    }catch(error){
     if(identity()){
      if(typeof openNotifications==='function')openNotifications();
      onStatus('通知開啟失敗：'+safeText(error?.code||error?.message||error));
     }
    }finally{button.disabled=false}
   };
   row.append(content,button);root.append(row);
  }
 }
 async function refresh({groups=null,quiet=false}={}){
  if(!identity()||busy)return;
  busy=true;
  try{
   const allowed=groups||await getGroups();
   if(!identity())return;
   const result=await source.read(allowed);
   if(!identity())return;
   entries=result.items;last=Date.now();render();
   setStatus(result.partial
    ?'部分群組通知無法從伺服器讀取（'+result.failedQueries+' 項）。請按重新整理重試。'
    :'已於 '+new Date(last).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',
      hour:'2-digit',minute:'2-digit'})+' 更新通知。'+
       (result.limited?'只檢查前 10 個群組。':''));
   if(!quiet&&markers.countUnread(entries))onStatus('有 '+markers.countUnread(entries)+' 則未讀通知。');
  }finally{busy=false}
 }
 async function refreshAll(){
  const b=$('refreshCloud');if(!identity()||b.disabled)return;
  const name=b.textContent;
  b.disabled=true;b.setAttribute('aria-busy','true');b.textContent='↻ 更新中';
  try{
   // Editor contents and drafts are not erased. There is no location.reload.
   const groups=await getGroups();if(!identity())return;
   await refreshViews();if(!identity())return;
   await refresh({groups,quiet:true});
   onStatus('已重新整理共用記事、任務與通知，沒有變更雲端資料。');
  }catch(error){if(identity())onStatus('重新整理失敗：'+safeText(error?.code||error?.message||error))}
  finally{
   if(identity()){b.disabled=false;b.removeAttribute('aria-busy');b.textContent=name}
  }
 }
 const visibility=()=>{
  if(!identity()||document.hidden||busy||Date.now()-last<300000||
   !$('app').getClientRects().length)return;
  void refresh({quiet:true}).catch(error=>{if(identity())setStatus(
   '通知更新失敗：'+safeText(error?.code||error?.message||error))});
 };
 function start(){
  if(!identity())return;
  $('notificationOverview').hidden=true;
  $('notificationCenter').hidden=true;
  $('refreshCloud').disabled=false;
  $('refreshCloud').onclick=refreshAll;
  $('toggleNotifications').onclick=()=>{
   clearReturn();
   if(typeof closeNotifications==='function')closeNotifications();
   else if(typeof restoreTab==='function')restoreTab('Notes');
  };
  $('markNotificationsRead').onclick=()=>{
   const saved=markers.markAll(entries.map(x=>x.id));
   render();setStatus(saved?'已將目前通知全部標示已讀。':
    '目前已標示已讀，但本機儲存不可用，重新開啟後可能重置。');
  };
  document.addEventListener('visibilitychange',visibility);
  timer=setInterval(visibility,300000);
  void refresh({quiet:true}).catch(error=>{
   if(identity())setStatus('暫時無法讀取通知：'+safeText(error?.code||error?.message||error));
  });
 }
 function stop(){
  stopped=true;clearReturn();clearInterval(timer);
  document.removeEventListener('visibilitychange',visibility);
  $('refreshCloud').disabled=true;
  $('notificationOverview').hidden=true;
  $('notificationList').replaceChildren();
  $('notificationCount').hidden=true;
 }
 return Object.freeze({start,stop,refresh,refreshAll,returnToNotifications,
  onTabChange:()=>{if(returnContext)clearReturn()}
 });
}
