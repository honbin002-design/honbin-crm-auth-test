import assert from 'node:assert/strict';
import {routeNotification} from './notification-recipient-router.mjs';
const group={id:'group_test',ownerUid:'uid_owner'};
const members=[
 {uid:'uid_vic',role:'VIEWER',status:'ACTIVE'},
 {uid:'uid_editor',role:'EDITOR',status:'ACTIVE'},
 {uid:'uid_revoked',role:'ADMIN',status:'REVOKED'},
 {uid:'uid_fake',role:'VIEWER',status:'PENDING'},
];
const call=(kind,itemId,record)=>routeNotification({kind,group,members,itemId,record});
const directed=call('TASK_ASSIGNED','task_1',{status:'OPEN',createdBy:'uid_owner',assignedUid:'uid_vic'});
assert.deepEqual(directed.recipients,['uid_vic']);
assert.deepEqual(directed.payload,{kind:'TASK_ASSIGNED',groupId:'group_test',taskId:'task_1'});
assert.equal(directed.eventId,'TASK_ASSIGNED:group_test:task_1');
const open=call('TASK_ASSIGNED','task_2',{status:'OPEN',createdBy:'uid_owner',assignedUid:null});
assert.deepEqual(new Set(open.recipients),new Set(['uid_vic','uid_editor']));
assert.ok(!open.recipients.includes('uid_revoked'));
assert.ok(!open.recipients.includes('uid_fake'));
const editorTask=call('TASK_ASSIGNED','task_3',{status:'OPEN',createdBy:'uid_editor',assignedUid:'uid_owner'});
assert.deepEqual(editorTask.recipients,['uid_owner']);
const own=call('TASK_ASSIGNED','task_4',{status:'OPEN',createdBy:'uid_owner',assignedUid:'uid_owner'});
assert.deepEqual(own.recipients,[]);
const done=call('TASK_COMPLETED','task_1',{status:'DONE',createdBy:'uid_owner',completedBy:'uid_vic'});
assert.deepEqual(done.recipients,['uid_owner']);
assert.equal(done.payload.kind,'TASK_COMPLETED');
const doneOwn=call('TASK_COMPLETED','task_5',{status:'DONE',createdBy:'uid_vic',completedBy:'uid_vic'});
assert.deepEqual(doneOwn.recipients,[]);
const note=call('SHARED_NOTE_CREATED','note_1',{groupId:'group_test',ownerUid:'uid_editor'});
assert.deepEqual(new Set(note.recipients),new Set(['uid_owner','uid_vic']));
assert.deepEqual(note.payload,{kind:'SHARED_NOTE_CREATED',groupId:'group_test',noteId:'note_1'});
assert.throws(()=>call('SHARED_NOTE_CREATED','note_2',{groupId:'other',ownerUid:'uid_owner'}),/INVALID_SHARED_NOTE/);
const revokedAssignee=call('TASK_ASSIGNED','task_6',{status:'OPEN',createdBy:'uid_owner',assignedUid:'uid_revoked'});
assert.deepEqual(revokedAssignee.recipients,[]);
assert.throws(()=>call('TASK_COMPLETED','task_6',{status:'DONE',createdBy:'uid_owner',completedBy:'uid_revoked'}),/INVALID_TASK_COMPLETION/);
assert.throws(()=>call('TASK_ASSIGNED','../evil',{status:'OPEN',createdBy:'uid_owner',assignedUid:null}),/INVALID_NOTIFICATION_EVENT/);
assert.throws(()=>call('SHARED_NOTE_CREATED','note_3',{groupId:'group_test',ownerUid:'uid_outsider'}),/INVALID_SHARED_NOTE/);
// A retired notebook retains historical members and notes in Firestore,
// but neither its owner nor old members can be targeted by push.
for(const kind of ['TASK_ASSIGNED','TASK_COMPLETED','SHARED_NOTE_CREATED']){
 const sample=kind==='TASK_ASSIGNED'
  ?{status:'OPEN',createdBy:'uid_owner',assignedUid:'uid_editor'}
  :kind==='TASK_COMPLETED'
   ?{status:'DONE',createdBy:'uid_owner',completedBy:'uid_editor'}
   :{groupId:'group_test',ownerUid:'uid_owner'};
 assert.throws(()=>routeNotification({
  kind,group:{...group,deleteState:'DELETING'},
  members,itemId:'old_item',record:sample
 }),/RETIRED_GROUP_NOTIFICATION_STOP/);
}
const changed=call('CHANGE_EVENT','event_1',{kind:'ORDER_UPDATED',itemId:'order_1',revision:3,
 actorUid:'uid_editor',changedAt:{toMillis:()=>42}});
assert.equal(changed.payload.orderId,'order_1');
assert.equal(changed.payload.eventDocId,'event_1');
assert.deepEqual(new Set(changed.recipients),new Set(['uid_owner','uid_vic']));
assert.throws(()=>call('CHANGE_EVENT','event_2',{kind:'ORDER_UPDATED',itemId:'order_1',revision:3,
 actorUid:'uid_revoked',changedAt:{toMillis:()=>42}}),/INVALID_CHANGE_EVENT/);
assert.throws(()=>call('CHANGE_EVENT','event_3',{kind:'PRIVATE_NOTE_UPDATED',itemId:'note_1',revision:1,
 actorUid:'uid_editor',changedAt:{toMillis:()=>42}}),/INVALID_CHANGE_EVENT/);
const serial=JSON.stringify([directed,open,done,note]);
assert.ok(!serial.includes('@gmail.com'));
assert.ok(!serial.includes('task title'));
console.log('TEST_NOTIFICATION_RECIPIENT_ROUTING_PASS');

