import assert from 'node:assert/strict';
import {deriveNotifications,notificationSource,notificationTitle} from './firebase-inapp-notifications.mjs';
import {notificationReadMarkers} from './notification-read-markers.mjs';
const t=m=>({toMillis:()=>m});
const now=Date.UTC(2026,9,22,3,0,0),me='user_1',actor='user_2';
const g={id:'team_1',name:'測試群組',role:'EDITOR'};
const streams=[
 {groupId:g.id,kind:'TASK_ASSIGNED',items:[
  {id:'task_1',data:{createdBy:actor,assignedUid:me,status:'OPEN',createdAt:t(now-30000)}},
  {id:'task_2',data:{createdBy:actor,assignedUid:'different',status:'OPEN',createdAt:t(now-30000)}},
  {id:'task_3',data:{createdBy:me,assignedUid:me,status:'OPEN',createdAt:t(now-30000)}}
 ]},
 {groupId:g.id,kind:'TASK_COMPLETED',items:[
  {id:'task_4',data:{createdBy:me,completedBy:actor,status:'DONE',completedAt:t(now-5000)}},
  {id:'task_5',data:{createdBy:actor,completedBy:me,status:'DONE',completedAt:t(now-5000)}}
 ]},
 {groupId:g.id,kind:'SHARED_NOTE_CREATED',items:[
  {id:'note_1',data:{ownerUid:actor,groupId:g.id,deleted:false,createdAt:t(now-10000)}},
  {id:'note_2',data:{ownerUid:me,groupId:g.id,deleted:false,createdAt:t(now-10000)}},
  {id:'note_3',data:{ownerUid:actor,groupId:g.id,deleted:true,createdAt:t(now-10000)}}
 ]},
 {groupId:'other_2',kind:'SHARED_NOTE_CREATED',items:[
  {id:'foreign',data:{ownerUid:actor,groupId:'other_2',deleted:false,createdAt:t(now-10000)}}]}
];
const found=deriveNotifications({uid:me,groups:[g],streams,now});
assert.equal(found.length,3,'only authorized recipient events');
assert.deepEqual(found.map(v=>v.kind),['TASK_COMPLETED','SHARED_NOTE_CREATED','TASK_ASSIGNED']);
assert.equal(found.every(e=>e.groupId===g.id),true);
assert.equal(found.some(e=>JSON.stringify(e).includes('private content')),false);
assert.equal(notificationTitle('TASK_ASSIGNED'),'有新任務指派');
assert.equal(deriveNotifications({uid:me,groups:[],streams,now}).length,0);
let currentUid=me,requests=[],failOne=false;
const records={};
records['tasks:createdAt']=[streams[0].items[0],streams[0].items[1]];
records['tasks:completedAt']=[streams[1].items[0]];
records['notes:createdAt']=[streams[2].items[0]];
const mock={
 collection:(_db,...parts)=>({path:parts.join('/'),type:parts.at(-1)}),
 orderBy:(field,direction)=>({field,direction}),
 limit:size=>({size}),
 query:(ref,sort,take)=>({ref,sort,take}),
 getDocsFromServer:async query=>{
  requests.push(query.ref.path+':'+query.sort.field);
  if(failOne&&query.ref.type==='notes')throw Object.assign(Error('denied'),{code:'permission-denied'});
  return {docs:(records[query.ref.type+':'+query.sort.field]||[]).map(item=>({
    id:item.id,data:()=>item.data
  }))};
 }
};
const source=notificationSource({db:{},sdk:mock,currentUid:()=>currentUid});
let result=await source.read([g],{now});
assert.equal(result.items.length,3);
assert.equal(result.partial,false);
assert.equal(requests.length,3,'bounded one query per stream and group');
failOne=true;result=await source.read([g],{now});
assert.equal(result.partial,true);
assert.equal(result.failedQueries,1);
assert.equal(result.items.some(e=>e.kind==='SHARED_NOTE_CREATED'),false,'denied reads never use cached notes');
currentUid='another';
await assert.rejects(source.read([g],{now}),/ACCOUNT_CHANGED|NOT_AUTHENTICATED/).catch(()=>{});
// Pure scoped local read markers: never save task titles or group names.
const store=new Map();
const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
const read=notificationReadMarkers({storage,uid:me});
assert.equal(read.countUnread(found),3);
assert.equal(read.mark(found[0].id),true);
assert.equal(notificationReadMarkers({storage,uid:me}).countUnread(found),2);
assert.equal(notificationReadMarkers({storage,uid:'other_user'}).countUnread(found),3);
read.markAll(found.map(v=>v.id));
assert.equal(notificationReadMarkers({storage,uid:me}).countUnread(found),0);
assert.equal(JSON.stringify([...store.values()]).includes('測試群組'),false);
console.log('INAPP_NOTICE_SERVER_SCOPING_AND_READ_MARKERS_PASS');
