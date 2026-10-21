import assert from 'node:assert/strict';
import {taskService,taskCanComplete} from './firebase-task-service.mjs';
// Synthetic TEST-only in-memory SDK. Never connects to Firestore.
const owner='uid_owner',viewer='uid_viewer',other='uid_other';
let signed=owner;
const database=new Map();const writes=[];
const timestamp=()=>({server:true});
const sdk={
  collection(_db,...parts){return {path:parts.join('/')}},
  doc(base,...parts){
   if(base&&typeof base.path==='string'){
    return {path:base.path+'/'+(parts.length?parts.join('/'):'synthetic_id')};
   }
   return {path:parts.join('/')};
  },
  getDocsFromServer:async ref=>({docs:[...database.entries()].filter(([p])=>p.startsWith(ref.path+'/'))
    .map(([path,value])=>({id:path.split('/').at(-1),data:()=>({...value})}))}),
  serverTimestamp:timestamp,
  async getDoc(ref){return {exists:()=>database.has(ref.path),data:()=>database.get(ref.path)}},
  async getDocFromServer(ref){return {exists:()=>database.has(ref.path),data:()=>database.get(ref.path)}},
  async setDoc(ref,data){writes.push({op:'set',path:ref.path,data});database.set(ref.path,{...data})},
  async runTransaction(_db,callback){
   const staging=[];
   const result=await callback({
    get:async ref=>({exists:()=>database.has(ref.path),data:()=>({...database.get(ref.path)})}),
    update:(ref,change)=>staging.push({path:ref.path,change,op:'update'}),
    set:(ref,change)=>staging.push({path:ref.path,change,op:'set'})
   });
   for(const update of staging){
    writes.push({op:update.op,path:update.path,...(update.op==='set'?{data:update.change}:{change:update.change})});
    database.set(update.path,{...database.get(update.path),...update.change});
   }
   return result;
  }
};
const service=taskService({db:{},sdk,currentUid:()=>signed});
const open=(assignedUid)=>({status:'OPEN',assignedUid,createdBy:owner,
 title:'測試任務',description:'',executeDate:'',dueDate:'',completedBy:null,
 completedAt:null,completionReply:''});
for(const invalid of ['',null])assert.equal(taskCanComplete(open(null),invalid),false);
signed=owner;await service.create({groupId:'group_test',title:'任務 A',
 assignedUid:viewer,executeDate:'2026-10-21',dueDate:'2026-10-30'});
const created=writes.at(-1);assert.equal(created.data.assignedUid,viewer);
assert.equal(created.data.executeDate,'2026-10-21');
assert.equal(created.op,'set');
const createdRef=created.path.split('/').at(-1);
const retry=await service.create({groupId:'group_test',taskId:createdRef,title:'任務 A',
 assignedUid:viewer,executeDate:'2026-10-21',dueDate:'2026-10-30'});
assert.equal(retry.alreadyCreated,true);
assert.equal(writes.length,1,'retry must not duplicate task');
await assert.rejects(service.create({groupId:'group_test',taskId:createdRef,
 title:'任務 B',assignedUid:viewer}),/TASK_ID_CONFLICT_STOP/);
assert.equal(writes.length,1,'conflicting retry must not mutate task');
await assert.rejects(service.create({groupId:'group_test',title:'測試',
 executeDate:'2026-10-31',dueDate:'2026-10-30'}),/EXECUTE_DATE_AFTER_DEADLINE/);
assert.equal(writes.length,1);
assert.equal(taskCanComplete(open(viewer),other),false);
signed=viewer;
// A pending extension must block completion client-side even before V5 server
// rules are released; never orphan a publisher approval request.
const pendingPath='groups/group_test/tasks/pending_extension';
const pendingTask={...open(viewer),extensionPendingId:'request_1'};
assert.equal(taskCanComplete(pendingTask,viewer),false);
assert.equal(taskCanComplete(pendingTask,owner),false);
database.set(pendingPath,pendingTask);
const beforePendingWrites=writes.length;
await assert.rejects(service.complete({
 groupId:'group_test',taskId:'pending_extension',reply:'不應完成'
}),/TASK_NOT_ASSIGNED_OR_ALREADY_DONE/);
assert.equal(writes.length,beforePendingWrites,'pending extension must never write completion');
assert.equal(database.get(pendingPath).status,'OPEN');
const taskPath='groups/group_test/tasks/test_task';
database.set(taskPath,open(viewer));
const first=await service.complete({groupId:'group_test',taskId:'test_task',reply:'已完成'});
assert.equal(first.completedBy,viewer);
assert.equal(database.get(taskPath).completedBy,viewer);
assert.deepEqual(database.get(taskPath).completedAt,timestamp());
assert.equal(database.get(taskPath).completionReply,'已完成');
const writeCount=writes.length;
await assert.rejects(service.complete({groupId:'group_test',taskId:'test_task',reply:'第二次'}),
 /TASK_NOT_ASSIGNED_OR_ALREADY_DONE/);
assert.equal(writes.length,writeCount,'Completion cannot be overwritten');
signed=other;database.set('groups/group_test/tasks/unassigned',open(null));
await service.complete({groupId:'group_test',taskId:'unassigned',reply:'完成'});
assert.equal(database.get('groups/group_test/tasks/unassigned').completedBy,other);
database.set('groups/group_test/tasks/assigned',open(viewer));
await assert.rejects(service.complete({groupId:'group_test',taskId:'assigned',reply:'我也完成'}),
 /TASK_NOT_ASSIGNED_OR_ALREADY_DONE/);
signed=owner;await service.saveNickname('威');
assert.equal(writes.at(-1).path,'profiles/'+owner);
signed=other;assert.equal(await service.profile(owner),'威');
assert.equal(writes.at(-1).path,'profiles/'+owner);
const brokenSdk={...sdk,async getDocFromServer(ref){
 if(ref.path==='profiles/'+owner)return {exists:()=>true,data:()=>({nickname:'異常'})};
 return {exists:()=>database.has(ref.path),data:()=>database.get(ref.path)};
}};
const mismatch=taskService({db:{},sdk:brokenSdk,currentUid:()=>signed});
signed=owner;
await assert.rejects(mismatch.saveNickname('測試伺服器核對'),/NICKNAME_SERVER_READBACK_MISMATCH/);
console.log('TASK_ASSIGNMENT_COMPLETION_AND_PUBLIC_NICKNAME_CLIENT_PASS');
