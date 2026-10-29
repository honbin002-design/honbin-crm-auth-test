// Pure TEST-only notification recipient router. No Firebase, credentials,
// network calls or production integration. Server must re-read membership
// and current task/note state before enqueueing a notification.
const ID=/^[A-Za-z0-9_-]{1,150}$/;
const valid=id=>typeof id==='string'&&ID.test(id);
const roles=new Set(['OWNER','ADMIN','EDITOR','VIEWER']);
const activeMember=m=>m&&valid(m.uid)&&m.status==='ACTIVE'&&roles.has(m.role);
function membership(group,members){
 if(!group||!valid(group.id)||!valid(group.ownerUid)||!Array.isArray(members))
  throw Error('INVALID_GROUP_CONTEXT');
 // A retired notebook may retain historical ACTIVE member documents; those
 // records must NEVER authorize new device notifications after retirement.
 if(group.deleteState)throw Error('RETIRED_GROUP_NOTIFICATION_STOP');
 const allowed=new Set([group.ownerUid]);
 for(const m of members)if(activeMember(m))allowed.add(m.uid);
 return allowed;
}
export function routeNotification({kind,group,members,itemId,record}){
 if(!valid(itemId)||!record||typeof record!=='object')
  throw Error('INVALID_NOTIFICATION_EVENT');
 const allowed=membership(group,members);
 let actor,recipients=[],payload;
 if(kind==='TASK_ASSIGNED'){
  if(record.status!=='OPEN'||!valid(record.createdBy)||!allowed.has(record.createdBy))
   throw Error('INVALID_TASK_CREATE');
  actor=record.createdBy;
  if(record.assignedUid!==null&&!valid(record.assignedUid))
   throw Error('INVALID_ASSIGNEE');
  recipients=record.assignedUid===null
   ?[...allowed].filter(uid=>uid!==actor)
   :allowed.has(record.assignedUid)&&record.assignedUid!==actor?[record.assignedUid]:[];
  payload={kind,groupId:group.id,taskId:itemId};
 }else if(kind==='TASK_COMPLETED'){
  if(record.status!=='DONE'||!valid(record.createdBy)||!valid(record.completedBy)
    ||!allowed.has(record.createdBy)||!allowed.has(record.completedBy))
   throw Error('INVALID_TASK_COMPLETION');
  actor=record.completedBy;
  recipients=record.createdBy===actor?[]:[record.createdBy];
  payload={kind,groupId:group.id,taskId:itemId};
 }else if(kind==='SHARED_NOTE_CREATED'){
  // Caller must pass a known /groups/{groupId}/notes/{noteId} document.
  if(record.groupId!==group.id||!valid(record.ownerUid)
    ||!allowed.has(record.ownerUid))throw Error('INVALID_SHARED_NOTE');
  actor=record.ownerUid;
  recipients=[...allowed].filter(uid=>uid!==actor);
  payload={kind,groupId:group.id,noteId:itemId};
 }else if(kind==='CHANGE_EVENT'){
  const types=new Set(['SHARED_NOTE_CREATED','SHARED_NOTE_UPDATED','SHARED_NOTE_DELETED','ORDER_CREATED','ORDER_UPDATED']);
  if(!types.has(record.kind)||!valid(record.itemId)||!valid(record.actorUid)||
     !allowed.has(record.actorUid)||!Number.isSafeInteger(record.revision)||record.revision<1||
     typeof record.changedAt?.toMillis!=='function')throw Error('INVALID_CHANGE_EVENT');
  actor=record.actorUid;
  recipients=[...allowed].filter(uid=>uid!==actor);
  payload={kind:record.kind,groupId:group.id,revision:record.revision,
    eventDocId:itemId,
    ...(record.kind.startsWith('ORDER_')?{orderId:record.itemId}:{noteId:record.itemId})};
 }else throw Error('INVALID_NOTIFICATION_KIND');
 return Object.freeze({
  eventId:kind+':'+group.id+':'+itemId,
  actorUid:actor,
  recipients:Object.freeze(recipients),
  payload:Object.freeze(payload)
 });
}

