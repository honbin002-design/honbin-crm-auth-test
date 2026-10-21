// Pure in-memory TEST-only service contract. No Firebase credential or network.
import assert from 'node:assert/strict';
import {taskExtensionService} from './firebase-task-extension-service.mjs';
const state=new Map();
let uid='publisher_user',serial=0,clock=0;
const db={testOnly:true};
const ref=(path)=>({path,id:path.split('/').at(-1)});
const pathOf=(r)=>r.path;
const collection=(root,...parts)=>ref(parts.join('/'));
const doc=(root,...parts)=>{
 if(parts.length===0)return ref(root.path+'/auto'+(++serial));
 if(root===db)return ref(parts.join('/'));
 return ref(root.path+'/'+parts.join('/'));
};
const snap=(r)=>({id:r.id,exists:()=>state.has(pathOf(r)),data:()=>({...state.get(pathOf(r))})});
const stamp=()=>({fakeServerTimestamp:true});
const resolved=(v)=>{
 if(v?.fakeServerTimestamp)return {toMillis:()=>++clock,toDate:()=>new Date(2026,9,21,10,46)};
 return v;
};
const runTransaction=async(root,fn)=>{
 assert.equal(root,db);
 const queued=[];
 const transaction={
  get:async r=>snap(r),
  set:(r,value)=>queued.push({type:'set',r,value}),
  update:(r,value)=>queued.push({type:'update',r,value})
 };
 const output=await fn(transaction);
 for(const q of queued){
  const before=state.get(pathOf(q.r));
  assert.ok(q.type==='set'||before,'update target must exist');
  state.set(pathOf(q.r),{
   ...(q.type==='update'?before:{}),
   ...Object.fromEntries(Object.entries(q.value).map(([k,v])=>[k,resolved(v)]))
  });
 }
 return output;
};
const getDocFromServer=async r=>snap(r);
const getDocsFromServer=async col=>({
 docs:[...state.entries()].filter(([k])=>k.startsWith(col.path+'/'))
  .map(([k,v])=>({id:k.split('/').at(-1),data:()=>({...v})}))
});
const sdk={collection,doc,runTransaction,serverTimestamp:stamp,getDocFromServer,getDocsFromServer};
const taskPath='groups/group_test/tasks/task_real';
state.set(taskPath,{status:'OPEN',createdBy:'publisher_user',
 assignedUid:'executor_user',dueDate:'2026-10-23',extensionPendingId:null});
const api=taskExtensionService({db,sdk,currentUid:()=>uid});
uid='executor_user';
await assert.rejects(api.request({groupId:'group_test',taskId:'task_real',
 newDueDate:'2026-10-23',reason:'No change'}),/EXTENSION_MUST_BE_LATER/);
const applied=await api.request({groupId:'group_test',taskId:'task_real',
 newDueDate:'2026-10-26',reason:'Testing request'});
assert.equal(state.get(taskPath).dueDate,'2026-10-23');
assert.equal(state.get(taskPath).extensionPendingId,applied.requestId);
const requestPath=taskPath+'/extensionRequests/'+applied.requestId;
assert.equal(state.get(requestPath).requestedBy,'executor_user');
assert.equal(state.get(requestPath).newDueDate,'2026-10-26');
await assert.rejects(api.request({groupId:'group_test',taskId:'task_real',
 newDueDate:'2026-10-27',reason:'Duplicate'}),/EXTENSION_NOT_ALLOWED/);
await assert.rejects(api.decide({groupId:'group_test',taskId:'task_real',
 requestId:applied.requestId,decision:'APPROVED',approvedDueDate:'2026-10-25'}),/EXTENSION_DECISION_NOT_ALLOWED/);
uid='publisher_user';
await assert.rejects(api.decide({groupId:'group_test',taskId:'task_real',
 requestId:applied.requestId,decision:'APPROVED'}),/APPROVED_DUE_DATE_REQUIRED/);
await assert.rejects(api.decide({groupId:'group_test',taskId:'task_real',
 requestId:applied.requestId,decision:'APPROVED',approvedDueDate:'2026-10-22'}),/APPROVED_DATE_MUST_BE_AFTER_ORIGINAL_DEADLINE/);
const decision=await api.decide({groupId:'group_test',taskId:'task_real',
 requestId:applied.requestId,decision:'APPROVED',approvedDueDate:'2026-10-25'});
assert.equal(decision.decision,'APPROVED');
assert.equal(decision.originalDueDate,'2026-10-23');
assert.equal(decision.effectiveDueDate,'2026-10-25');
assert.equal(decision.approvedDueDate,'2026-10-25');
assert.equal(state.get(taskPath).dueDate,'2026-10-25');
assert.equal(state.get(requestPath).newDueDate,'2026-10-26');
assert.equal(state.get(requestPath).approvedDueDate,'2026-10-25');
assert.equal(state.get(requestPath).decidedBy,'publisher_user');
assert.equal(state.get(taskPath).extensionPendingId,null);
const audit=await api.list({groupId:'group_test',taskId:'task_real'});
assert.equal(audit.length,1);
assert.equal(audit[0].approvedDueDate,'2026-10-25');
await assert.rejects(api.decide({groupId:'group_test',taskId:'task_real',
 requestId:applied.requestId,decision:'APPROVED',approvedDueDate:'2026-10-28'}),/EXTENSION_DECISION_NOT_ALLOWED/);
uid='executor_user';
const rejectedRequest=await api.request({groupId:'group_test',taskId:'task_real',
 newDueDate:'2026-10-28',reason:'Second try'});
uid='publisher_user';
await assert.rejects(api.decide({groupId:'group_test',taskId:'task_real',
 requestId:rejectedRequest.requestId,decision:'REJECTED',approvedDueDate:'2026-10-28'}),/REJECTED_MUST_NOT_SET_APPROVED_DATE/);
const rejected=await api.decide({groupId:'group_test',taskId:'task_real',
 requestId:rejectedRequest.requestId,decision:'REJECTED'});
assert.equal(rejected.originalDueDate,'2026-10-25');
assert.equal(rejected.effectiveDueDate,'2026-10-25');
assert.equal(state.get(taskPath).dueDate,'2026-10-25');
assert.equal(state.get(taskPath+'/extensionRequests/'+rejectedRequest.requestId).status,'REJECTED');
// V5 opt-in stores original deadline without changing pre-deployment V4 writes.
const originalPath='groups/group_test/tasks/task_original';
state.set(originalPath,{status:'OPEN',createdBy:'publisher_user',
 assignedUid:'executor_user',dueDate:'2026-10-23',extensionPendingId:null});
uid='executor_user';
const v5=taskExtensionService({db,sdk,currentUid:()=>uid,recordOriginalDueDate:true});
const extended=await v5.request({groupId:'group_test',taskId:'task_original',
 newDueDate:'2026-10-27',reason:'V5 original deadline audit'});
assert.equal(state.get(originalPath).dueDate,'2026-10-23');
const v5Request=state.get(originalPath+'/extensionRequests/'+extended.requestId);
assert.equal(v5Request.originalDueDate,'2026-10-23');
assert.equal(v5Request.newDueDate,'2026-10-27');
console.log('TEST_TASK_V4_CLIENT_CONTRACT_PASS (IN_MEMORY_ONLY)');
