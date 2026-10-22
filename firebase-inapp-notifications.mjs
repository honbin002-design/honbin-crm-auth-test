// Zero-server-cost, server-authorized foreground notification reader.
// This module never reads another user's private notes or device subscriptions.
// All queries are scoped to ACTIVE notebook groups returned by the current user.
const ID=/^[A-Za-z0-9_-]{1,150}$/;
const permitted=new Set(['TASK_ASSIGNED','TASK_COMPLETED','SHARED_NOTE_CREATED']);
const timestamp=value=>{
 if(typeof value?.toMillis==='function')return value.toMillis();
 if(value instanceof Date)return value.getTime();
 return 0;
};
const validGroup=group=>group&&ID.test(group.id)&&typeof group.name==='string'&&
 ['ADMIN','EDITOR','VIEWER'].includes(group.role);
export function deriveNotifications({uid,groups,streams,now=Date.now(),ageDays=30}){
 if(!ID.test(uid)||!Array.isArray(groups)||!Array.isArray(streams))
  throw Error('NOTIFICATION_CONTEXT_REQUIRED');
 const allowed=new Map(groups.filter(validGroup).map(g=>[g.id,g]));
 const min=now-Math.min(Math.max(ageDays,1),30)*86400000;
 const result=new Map();
 function append(kind,group,record,id,when){
  if(!permitted.has(kind)||!ID.test(id))return;
  const at=timestamp(when);
  if(at<min||at>now+60000)return;
  const eventId=kind+':'+group.id+':'+id;
  const event=Object.freeze({id:eventId,kind,groupId:group.id,
   groupName:group.name,itemId:id,at,tab:kind==='SHARED_NOTE_CREATED'?'Notes':'Tasks'});
  result.set(eventId,event);
 }
 for(const stream of streams){
  const group=allowed.get(stream.groupId);
  if(!group||!Array.isArray(stream.items))continue;
  for(const entry of stream.items){
   if(!ID.test(entry?.id))continue;
   const record=entry.data;
   if(!record||typeof record!=='object')continue;
   if(stream.kind==='TASK_ASSIGNED'){
    if(record.createdBy===uid||!ID.test(record.createdBy)||
      !['OPEN','DONE'].includes(record.status))continue;
    if(record.assignedUid!==null&&record.assignedUid!==uid)continue;
    append(stream.kind,group,record,entry.id,record.createdAt);
   }else if(stream.kind==='TASK_COMPLETED'){
    if(record.createdBy!==uid||record.completedBy===uid||
      !ID.test(record.completedBy)||record.status!=='DONE')continue;
    append(stream.kind,group,record,entry.id,record.completedAt);
   }else if(stream.kind==='SHARED_NOTE_CREATED'){
    if(record.groupId!==group.id||record.ownerUid===uid||
      !ID.test(record.ownerUid)||record.deleted!==false)continue;
    append(stream.kind,group,record,entry.id,record.createdAt);
   }
  }
 }
 return [...result.values()].sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id))
  .slice(0,120);
}
export function notificationTitle(kind){
 return kind==='TASK_ASSIGNED'?'有新任務指派':
  kind==='TASK_COMPLETED'?'你發布的任務已完成':
  kind==='SHARED_NOTE_CREATED'?'共用記事簿有新記事':'共用通知';
}
// An on-screen inbox can work on Safari and inside the existing CRM iframe.
// Apple lock-screen Web Push additionally requires signed subscriptions,
// sender-side credentials, notification permission, and server ACL validation.
export function notificationSource({db,sdk,currentUid,maxGroups=10,size=8}){
 if(!db||typeof currentUid!=='function'||!sdk||
   !Number.isSafeInteger(maxGroups)||maxGroups<1||maxGroups>10||
   !Number.isSafeInteger(size)||size<1||size>10)
  throw Error('NOTIFICATION_SOURCE_REQUIRED');
 const {collection,query,orderBy,limit,getDocsFromServer}=sdk;
 if([collection,query,orderBy,limit,getDocsFromServer].some(f=>typeof f!=='function'))
  throw Error('SERVER_ONLY_NOTIFICATIONS_REQUIRED');
 async function read(groups,{now=Date.now()}={}){
  const uid=currentUid();
  if(!ID.test(uid)||!Array.isArray(groups))throw Error('NOT_AUTHENTICATED');
  const eligible=groups.filter(validGroup).slice(0,maxGroups);
  const streams=[],errors=[];
  for(const g of eligible){
   if(currentUid()!==uid)throw Error('ACCOUNT_CHANGED');
   for(const x of [
    {kind:'TASK_ASSIGNED',folder:'tasks',field:'createdAt'},
    {kind:'TASK_COMPLETED',folder:'tasks',field:'completedAt'},
    {kind:'SHARED_NOTE_CREATED',folder:'notes',field:'createdAt'}
   ]){
    try{
     const ref=collection(db,'groups',g.id,x.folder);
     const docs=await getDocsFromServer(query(ref,orderBy(x.field,'desc'),limit(size)));
     if(currentUid()!==uid)throw Error('ACCOUNT_CHANGED');
     streams.push({groupId:g.id,kind:x.kind,
      items:docs.docs.map(d=>({id:d.id,data:d.data()}))});
    }catch(error){
     if(currentUid()!==uid)throw Error('ACCOUNT_CHANGED');
     // Fail closed on permission or connectivity failure: no stale cached
     // notification names, no cross-account or group fallback.
     errors.push({groupId:g.id,kind:x.kind,code:String(error?.code||'SERVER_READ_FAILED')});
    }
   }
  }
  return Object.freeze({items:deriveNotifications({uid,groups:eligible,streams,now}),
   partial:errors.length>0,failedQueries:errors.length,
   groupsChecked:eligible.length,limited:groups.length>maxGroups});
 }
 return Object.freeze({read});
}
