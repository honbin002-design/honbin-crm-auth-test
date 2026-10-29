import assert from 'node:assert/strict';
import {notificationEventStillRelevant as check} from './notification-event-freshness.mjs';
const ev=(kind,id)=>({actorUid:'actor_1',payload:{
 kind,groupId:'group_1',...(kind==='SHARED_NOTE_CREATED'?{noteId:id}:{taskId:id})}});
const assigned=ev('TASK_ASSIGNED','task_1');
const baseTask={status:'OPEN',createdBy:'actor_1',assignedUid:'member_2'};
assert.equal(check(assigned,baseTask,'member_2'),true);
assert.equal(check(assigned,baseTask,'member_3'),false);
assert.equal(check(assigned,baseTask,'actor_1'),false);
assert.equal(check(assigned,{...baseTask,status:'DONE'},'member_2'),false);
assert.equal(check(assigned,{...baseTask,assignedUid:'member_3'},'member_2'),false);
assert.equal(check(assigned,{...baseTask,assignedUid:null},'member_3'),true);
const completed=ev('TASK_COMPLETED','task_1');
const done={status:'DONE',createdBy:'member_2',completedBy:'actor_1'};
assert.equal(check(completed,done,'member_2'),true);
assert.equal(check(completed,done,'member_3'),false);
assert.equal(check(completed,{...done,status:'OPEN'},'member_2'),false);
assert.equal(check(completed,{...done,completedBy:'member_3'},'member_2'),false);
const note=ev('SHARED_NOTE_CREATED','note_1');
const newNote={groupId:'group_1',ownerUid:'actor_1',deleted:false};
assert.equal(check(note,newNote,'member_2'),true);
assert.equal(check(note,newNote,'actor_1'),false);
assert.equal(check(note,{...newNote,deleted:true},'member_2'),false);
assert.equal(check(note,{...newNote,groupId:'group_2'},'member_2'),false);
assert.equal(check(note,{...newNote,ownerUid:'member_3'},'member_2'),false);
assert.equal(check(note,{...newNote,deleted:undefined},'member_2'),false);
assert.equal(check({actorUid:'actor_1',payload:{kind:'UNKNOWN',groupId:'group_1',taskId:'x'}},
 baseTask,'member_2'),false);
const orderChanged={actorUid:'actor_1',payload:{kind:'ORDER_UPDATED',groupId:'group_1',orderId:'order_1',revision:2}};
assert.equal(check(orderChanged,{revision:3},'member_2'),true);
assert.equal(check(orderChanged,{revision:1},'member_2'),false);
const noteChanged={actorUid:'actor_1',payload:{kind:'SHARED_NOTE_DELETED',groupId:'group_1',noteId:'note_1',revision:3}};
assert.equal(check(noteChanged,{groupId:'group_1',version:4,deleted:true},'member_2'),true);
assert.equal(check(noteChanged,{groupId:'different',version:4,deleted:true},'member_2'),false);
console.log('TEST_PUSH_FINAL_EVENT_FRESHNESS_REVALIDATION_PASS');

