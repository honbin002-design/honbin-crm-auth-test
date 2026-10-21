// TEST-only, explicit-call task extension workflow. Never runs on import.
// All operations require deployed Firestore V3 ACL; otherwise server denies.
const ID=/^[A-Za-z0-9_-]{1,150}$/;
const valid=(v,name)=>{if(typeof v!=='string'||!ID.test(v))throw Error('INVALID_'+name);return v};
const date=/^\d{4}-\d{2}-\d{2}$/;
export function taskExtensionService({db,sdk,currentUid}){
 const {collection,doc,runTransaction,serverTimestamp,getDocFromServer,getDocsFromServer}=sdk||{};
 if(!db||typeof currentUid!=='function'||![collection,doc,runTransaction,serverTimestamp,getDocFromServer,getDocsFromServer].every(f=>typeof f==='function'))
  throw Error('TASK_EXTENSION_CONTEXT_REQUIRED');
 const actor=()=>valid(currentUid(),'UID');
 const parent=(groupId,taskId)=>doc(db,'groups',valid(groupId,'GROUP_ID'),'tasks',valid(taskId,'TASK_ID'));
 const requests=(groupId,taskId)=>collection(db,'groups',valid(groupId,'GROUP_ID'),'tasks',valid(taskId,'TASK_ID'),'extensionRequests');
 async function list({groupId,taskId}){
  const uid=actor(),snap=await getDocsFromServer(requests(groupId,taskId));
  if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
  return snap.docs.map(d=>({id:d.id,...d.data()}))
   .sort((a,b)=>(b.requestedAt?.toMillis?.()||0)-(a.requestedAt?.toMillis?.()||0));
 }
 async function request({groupId,taskId,newDueDate,reason}){
  const uid=actor(),message=String(reason||'').trim();
  if(!date.test(newDueDate||''))throw Error('INVALID_NEW_DUE_DATE');
  if(!message||message.length>1000)throw Error('INVALID_EXTENSION_REASON');
  const task=parent(groupId,taskId),ref=doc(requests(groupId,taskId));
  await runTransaction(db,async tx=>{
   const snap=await tx.get(task);
   if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
   if(!snap.exists())throw Error('TASK_NOT_FOUND');
   const data=snap.data();
   if(data.status!=='OPEN'||!data.dueDate||data.extensionPendingId||
      (data.assignedUid!==null&&data.assignedUid!==uid))
    throw Error('EXTENSION_NOT_ALLOWED');
   if(newDueDate<=data.dueDate)throw Error('EXTENSION_MUST_BE_LATER');
   tx.update(task,{extensionPendingId:ref.id});
   tx.set(ref,{requestedBy:uid,requestedAt:serverTimestamp(),reason:message,
    newDueDate,status:'PENDING',decidedBy:null,decidedAt:null});
  });
  if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
  const [taskRead,requestRead]=await Promise.all([getDocFromServer(task),getDocFromServer(ref)]);
  if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
  if(!taskRead.exists()||taskRead.data().extensionPendingId!==ref.id||
    !requestRead.exists()||requestRead.data().status!=='PENDING'||
    requestRead.data().requestedBy!==uid||requestRead.data().newDueDate!==newDueDate)
   throw Error('EXTENSION_REQUEST_SERVER_READBACK_MISMATCH');
  return {requestId:ref.id};
 }
 async function decide({groupId,taskId,requestId,decision,approvedDueDate}){
  const uid=actor();
  if(!['APPROVED','REJECTED'].includes(decision))throw Error('INVALID_EXTENSION_DECISION');
  if(decision==='APPROVED'&&(!date.test(approvedDueDate||'')))
   throw Error('APPROVED_DUE_DATE_REQUIRED');
  if(decision==='REJECTED'&&approvedDueDate!==undefined)
   throw Error('REJECTED_MUST_NOT_SET_APPROVED_DATE');
  const task=parent(groupId,taskId),ref=doc(requests(groupId,taskId),valid(requestId,'REQUEST_ID'));
  let expectedOriginalDueDate=null;
  await runTransaction(db,async tx=>{
   const [taskSnap,reqSnap]=await Promise.all([tx.get(task),tx.get(ref)]);
   if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
   if(!taskSnap.exists()||!reqSnap.exists())throw Error('EXTENSION_REQUEST_NOT_FOUND');
   const before=taskSnap.data(),req=reqSnap.data();
   if(before.status!=='OPEN'||before.createdBy!==uid||
      before.extensionPendingId!==requestId||req.status!=='PENDING')
    throw Error('EXTENSION_DECISION_NOT_ALLOWED');
   if(decision==='APPROVED'&&approvedDueDate<=before.dueDate)
    throw Error('APPROVED_DATE_MUST_BE_AFTER_ORIGINAL_DEADLINE');
   expectedOriginalDueDate=before.dueDate;
   tx.update(task,{extensionPendingId:null,
    ...(decision==='APPROVED'?{dueDate:approvedDueDate}:{})});
   tx.update(ref,{status:decision,decidedBy:uid,decidedAt:serverTimestamp(),
    ...(decision==='APPROVED'?{approvedDueDate}:{})});
  });
  if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
  const [taskRead,reqRead]=await Promise.all([getDocFromServer(task),getDocFromServer(ref)]);
  if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
  if(!taskRead.exists()||taskRead.data().extensionPendingId!==null||
     !reqRead.exists()||reqRead.data().status!==decision||reqRead.data().decidedBy!==uid||
     !reqRead.data().decidedAt||
     (decision==='APPROVED'&&(
       taskRead.data().dueDate!==approvedDueDate||
       reqRead.data().approvedDueDate!==approvedDueDate))||
     (decision==='REJECTED'&&(
       taskRead.data().dueDate!==expectedOriginalDueDate||
       Object.prototype.hasOwnProperty.call(reqRead.data(),'approvedDueDate'))))
   throw Error('EXTENSION_DECISION_SERVER_READBACK_MISMATCH');
  return {requestId,decision,originalDueDate:expectedOriginalDueDate,
   effectiveDueDate:taskRead.data().dueDate,
   ...(decision==='APPROVED'?{approvedDueDate}:{})};
 }
 return Object.freeze({list,request,decide});
}
