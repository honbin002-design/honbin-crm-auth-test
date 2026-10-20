// TEST-only task service. No SDK initialization or implicit network requests.
// Firestore Rules MUST authorize every operation before this can work.
const ID=/^[A-Za-z0-9_-]{1,150}$/;
const valid=(v,name)=>{if(typeof v!=='string'||!ID.test(v))throw Error('INVALID_'+name);return v};
const text=(v,max,name)=>{const s=String(v||'').trim();if(!s||s.length>max)throw Error('INVALID_'+name);return s};
export function taskCanComplete(task,uid){
 return Boolean(task&&task.status==='OPEN'&&uid&&
   (task.assignedUid===null||task.assignedUid===uid));
}
export function taskService({db,sdk,currentUid}){
 if(!db||!sdk||typeof currentUid!=='function')throw Error('TASK_CONTEXT_REQUIRED');
 const {collection,doc,getDocs,runTransaction,serverTimestamp,getDoc,getDocFromServer,setDoc}=sdk;
 if(![collection,doc,getDocs,runTransaction,serverTimestamp,getDoc,getDocFromServer,setDoc].every(f=>typeof f==='function'))
  throw Error('TASK_SDK_REQUIRED');
 const actor=()=>valid(currentUid(),'UID');
 const taskRef=groupId=>collection(db,'groups',valid(groupId,'GROUP_ID'),'tasks');
 async function list(groupId){
  actor();
  const result=await getDocs(taskRef(groupId));
  actor();
  return result.docs.map(d=>({id:d.id,...d.data()}))
    .sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
 }
 async function create({groupId,title,description='',assignedUid=null,executeDate='',dueDate=''}){
  const uid=actor(),name=text(title,120,'TASK_TITLE');
  const detail=String(description||'').trim();
  if(detail.length>3000)throw Error('INVALID_TASK_DESCRIPTION');
  if(assignedUid!==null)valid(assignedUid,'ASSIGNEE');
  if(executeDate!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(executeDate))throw Error('INVALID_EXECUTE_DATE');
  if(dueDate!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))throw Error('INVALID_DUE_DATE');
  if(executeDate&&dueDate&&executeDate>dueDate)throw Error('EXECUTE_DATE_AFTER_DEADLINE');
  const ref=doc(taskRef(groupId));
  await setDoc(ref,{title:name,description:detail,assignedUid,executeDate,dueDate,
    status:'OPEN',createdBy:uid,createdAt:serverTimestamp(),
    completedBy:null,completedAt:null,completionReply:''});
  actor();return ref.id;
 }
 async function complete({groupId,taskId,reply}){
  const uid=actor(),message=text(reply,3000,'TASK_REPLY');
  const ref=doc(taskRef(groupId),valid(taskId,'TASK_ID'));
  return runTransaction(db,async tx=>{
   const snapshot=await tx.get(ref);
   if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
   if(!snapshot.exists())throw Error('TASK_NOT_FOUND');
   const before=snapshot.data();
   if(!taskCanComplete(before,uid))throw Error('TASK_NOT_ASSIGNED_OR_ALREADY_DONE');
   tx.update(ref,{status:'DONE',completedBy:uid,
     completedAt:serverTimestamp(),completionReply:message});
   return {taskId,completedBy:uid};
  });
 }
 async function profile(uid){
  const key=valid(uid,'PROFILE_UID');
  const originalUid=actor();
  const snap=await getDocFromServer(doc(db,'profiles',key));
  if(actor()!==originalUid)throw Error('ACCOUNT_CHANGED');
  return snap.exists()?snap.data().nickname||'': '';
 }
 async function saveNickname(nickname){
  const uid=actor(),name=text(nickname,24,'NICKNAME');
  const ref=doc(db,'profiles',uid);
  await setDoc(ref,{nickname:name,updatedAt:serverTimestamp()});
  if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
  const verified=await getDocFromServer(ref);
  if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
  if(!verified.exists()||verified.data().nickname!==name)
    throw Error('NICKNAME_SERVER_READBACK_MISMATCH');
  return name;
 }
 return Object.freeze({list,create,complete,profile,saveNickname});
}
