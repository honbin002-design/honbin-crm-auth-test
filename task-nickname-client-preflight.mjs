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
  getDocs:async ref=>({docs:[...database.entries()].filter(([p])=>p.startsWith(ref.path+'/'))
    .map(([path,value])=>({id:path.split('/').at(-1),data:()=>({...value})}))}),
  serverTimestamp:timestamp,
  async getDoc(ref){return {exists:()=>database.has(ref.path),data:()=>database.get(ref.path)}},
  async setDoc(ref,data){writes.push({op:'set',path:ref.path,data});database.set(ref.path,{...data})},
  async runTransaction(_db,callback){
   const staging=[];
   const result=await callback({
    get:async ref=>({exists:()=>database.has(ref.path),data:()=>({...database.get(ref.path)})}),
    update:(ref,change)=>staging.push({path:ref.path,change})
   });
   for(const update of staging){
    writes.push({op:'update',...update});
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
await assert.rejects(service.create({groupId:'group_test',title:'測試',
 executeDate:'2026-10-31',dueDate:'2026-10-30'}),/EXECUTE_DATE_AFTER_DEADLINE/);
assert.equal(writes.length,1);
assert.equal(taskCanComplete(open(viewer),other),false);
signed=viewer;
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
console.log('TASK_ASSIGNMENT_COMPLETION_AND_PUBLIC_NICKNAME_CLIENT_PASS');
