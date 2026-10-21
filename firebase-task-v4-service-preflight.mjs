// TEST-only V4 task service regression. Synthetic data; no Firebase account/network.
import assert from 'node:assert/strict';
import {taskExtensionService} from './firebase-task-extension-service.mjs';
function fixture(initialUid='publisher'){
 const docs=new Map();
 const taskPath='groups/test_group/tasks/task_1';
 const reqPath=taskPath+'/extensionRequests/ext_1';
 docs.set(taskPath,{status:'OPEN',createdBy:'publisher',assignedUid:null,
  dueDate:'2026-10-23',extensionPendingId:'ext_1'});
 docs.set(reqPath,{status:'PENDING',newDueDate:'2026-10-26',reason:'synthetic',
  requestedBy:'executor',requestedAt:{seconds:10},decidedBy:null,decidedAt:null});
 let uid=initialUid;
 const reference=(base,segments)=>{
  const prefix=typeof base?.path==='string'?base.path+'/':'';
  return {path:prefix+segments.join('/')};
 };
 const sdk={
  collection:(db,...segments)=>reference(db,segments),
  doc:(db,...segments)=>reference(db,segments),
  serverTimestamp:()=>({__serverTimestamp:true}),
  getDocFromServer:async ref=>{
   const data=docs.get(ref.path);
   return {exists:()=>!!data,data:()=>data};
  },
  getDocsFromServer:async ref=>({docs:[...docs.entries()]
   .filter(([path])=>path.startsWith(ref.path+'/'))
   .map(([path,value])=>({id:path.split('/').at(-1),data:()=>value}))}),
  runTransaction:async (_db,fn)=>{
   const pending=[];
   const tx={
    get:async ref=>{
     const data=docs.get(ref.path);
     return {exists:()=>!!data,data:()=>data};
    },
    update:(ref,changes)=>pending.push([ref.path,changes])
   };
   const result=await fn(tx);
   for(const [path,changes] of pending){
    if(!docs.has(path))throw Error('MISSING_DOC');
    docs.set(path,{...docs.get(path),...changes});
   }
   return result;
  }
 };
 return {docs,taskPath,reqPath,
  service:taskExtensionService({db:{},sdk,currentUid:()=>uid}),
  setUid:next=>uid=next};
}
{
 const m=fixture();
 const result=await m.service.decide({groupId:'test_group',taskId:'task_1',
  requestId:'ext_1',decision:'APPROVED',approvedDueDate:'2026-10-25'});
 assert.equal(result.decision,'APPROVED');
 assert.equal(m.docs.get(m.taskPath).dueDate,'2026-10-25');
 assert.equal(m.docs.get(m.reqPath).newDueDate,'2026-10-26');
 assert.equal(m.docs.get(m.reqPath).approvedDueDate,'2026-10-25');
 assert.equal(m.docs.get(m.reqPath).status,'APPROVED');
 assert.equal(m.docs.get(m.reqPath).decidedBy,'publisher');
 await assert.rejects(m.service.decide({groupId:'test_group',taskId:'task_1',
  requestId:'ext_1',decision:'APPROVED',approvedDueDate:'2026-10-27'}),/EXTENSION_DECISION_NOT_ALLOWED/);
}
{
 const m=fixture();
 await assert.rejects(m.service.decide({groupId:'test_group',taskId:'task_1',
  requestId:'ext_1',decision:'APPROVED',approvedDueDate:'2026-10-23'}),
  /APPROVED_DATE_MUST_BE_AFTER_ORIGINAL_DEADLINE/);
 assert.equal(m.docs.get(m.reqPath).status,'PENDING');
}
{
 const m=fixture('executor');
 await assert.rejects(m.service.decide({groupId:'test_group',taskId:'task_1',
  requestId:'ext_1',decision:'APPROVED',approvedDueDate:'2026-10-25'}),/EXTENSION_DECISION_NOT_ALLOWED/);
 assert.equal(m.docs.get(m.taskPath).dueDate,'2026-10-23');
 assert.equal(m.docs.get(m.reqPath).status,'PENDING');
}
{
 const m=fixture();
 const result=await m.service.decide({groupId:'test_group',taskId:'task_1',
  requestId:'ext_1',decision:'REJECTED'});
 assert.equal(result.decision,'REJECTED');
 assert.equal(m.docs.get(m.taskPath).dueDate,'2026-10-23');
 assert.equal(m.docs.get(m.reqPath).status,'REJECTED');
 assert.equal(m.docs.get(m.reqPath).approvedDueDate,undefined);
}
{
 const m=fixture();
 await assert.rejects(m.service.decide({groupId:'test_group',taskId:'task_1',
  requestId:'ext_1',decision:'REJECTED',approvedDueDate:'2026-10-25'}),
 /REJECTED_MUST_NOT_SET_APPROVED_DATE/);
}
console.log('TASK_V4_SERVICE_SYNTHETIC_APPROVAL_REJECTION_PASS');
