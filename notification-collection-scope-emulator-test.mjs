import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore,Timestamp,FieldPath} from 'firebase-admin/firestore';
const db=getFirestore(initializeApp({projectId:'demo-honbin-change-stream'}));
const t=Timestamp.fromMillis(Date.parse('2026-10-23T00:16:00Z'));
const a=db.collection('groups').doc('group_a');
const b=db.collection('groups').doc('group_b');
await Promise.all([a.set({name:'A'}),b.set({name:'B'})]);
await a.collection('notificationEvents').doc('event_1').set({changedAt:t,kind:'ORDER_CREATED'});
await a.collection('notificationEvents').doc('event_2').set({changedAt:t,kind:'ORDER_UPDATED'});
await b.collection('notificationEvents').doc('event_3').set({changedAt:t,kind:'SHARED_NOTE_UPDATED'});
const groups=await db.collection('groups').orderBy(FieldPath.documentId()).limit(11).get();
assert.deepEqual(groups.docs.map(d=>d.id),['group_a','group_b']);
const q=a.collection('notificationEvents').where('changedAt','>=',t)
 .orderBy('changedAt','asc').orderBy(FieldPath.documentId(),'asc').limit(40);
const first=await q.get();
assert.deepEqual(first.docs.map(d=>d.id),['event_1','event_2']);
const cursor=first.docs[0];
await cursor.ref.delete();
const resumed=await q.startAfter(cursor.get('changedAt'),cursor.ref).get();
assert.deepEqual(resumed.docs.map(d=>d.id),['event_2']);
const other=await b.collection('notificationEvents').where('changedAt','>=',t)
 .orderBy('changedAt','asc').orderBy(FieldPath.documentId(),'asc').limit(40).get();
assert.deepEqual(other.docs.map(d=>d.id),['event_3']);
console.log('COLLECTION_SCOPED_CHANGE_CURSOR_PASS');
