// Pure TEST-only final pre-delivery event authorization. This check is run
// against a newly read Firestore document, never a cached event snapshot.
export function notificationEventStillRelevant(event,record,recipientUid){
 if(!event||!event.payload||!record||typeof record!=='object'||
   typeof recipientUid!=='string'||!recipientUid)return false;
 const {kind,groupId,taskId,noteId,orderId,revision}=event.payload;
 if(typeof groupId!=='string'||!groupId||
   typeof event.actorUid!=='string'||!event.actorUid||
   recipientUid===event.actorUid)return false;
 if(kind==='SHARED_NOTE_CREATED'&&!revision){
  return typeof noteId==='string'&&!!noteId&&
   record.groupId===groupId&&record.deleted===false&&
   record.ownerUid===event.actorUid;
 }
 if(['SHARED_NOTE_CREATED','SHARED_NOTE_UPDATED','SHARED_NOTE_DELETED'].includes(kind)&&
    Number.isSafeInteger(revision)&&revision>=1){
  return typeof noteId==='string'&&!!noteId&&record.groupId===groupId&&
    Number.isSafeInteger(record.version)&&record.version>=revision;
 }
 if(['ORDER_CREATED','ORDER_UPDATED'].includes(kind)){
  return typeof orderId==='string'&&!!orderId&&
    Number.isSafeInteger(revision)&&revision>=1&&
    Number.isSafeInteger(record.revision)&&record.revision>=revision;
 }
 if(typeof taskId!=='string'||!taskId)return false;
 if(kind==='TASK_ASSIGNED'){
  return record.status==='OPEN'&&record.createdBy===event.actorUid&&
   (record.assignedUid===null||record.assignedUid===recipientUid);
 }
 if(kind==='TASK_COMPLETED'){
  return record.status==='DONE'&&record.completedBy===event.actorUid&&
   record.createdBy===recipientUid;
 }
 return false;
}

