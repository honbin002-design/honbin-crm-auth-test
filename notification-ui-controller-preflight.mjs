import assert from 'node:assert/strict';
import {cloudNotificationController} from './firebase-cloud-notification-ui.mjs';
// In-memory DOM/Snapshot fakes only. No Firebase SDK, no network, no live data.
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.attributes={};
  this.hidden=false;this.disabled=false;this.textContent='';this.className='';this.onclick=null}
 append(...nodes){for(const x of nodes){x.parentNode=this;this.children.push(x)}}
 prepend(...nodes){for(const x of [...nodes].reverse()){x.parentNode=this;this.children.unshift(x)}}
 removeChild(node){this.children=this.children.filter(x=>x!==node);node.parentNode=null}
 querySelectorAll(selector){return this.children.filter(x=>selector==='[data-task-id]'&&x.dataset.taskId||selector==='[data-note-id]'&&x.dataset.noteId)}
 replaceChildren(...nodes){this.children=[...nodes]}
 setAttribute(key,val){this.attributes[key]=val}
 removeAttribute(key){delete this.attributes[key]}
 getClientRects(){return [1]}
}
const nodes=new Map();
const document={
 hidden:false,
 getElementById(id){if(!nodes.has(id))nodes.set(id,new Element);return nodes.get(id)},
 createElement:tag=>new Element(tag),
 createTextNode:text=>({textContent:String(text)}),
 addEventListener(){},removeEventListener(){}
};
globalThis.document=document;
const $=id=>document.getElementById(id);
const now=Date.now(),millis=x=>({toMillis:()=>x});
const events={
 'tasks:createdAt':[{
  id:'task_new',data:{createdBy:'author_2',assignedUid:'member_1',
   createdAt:millis(now-30000),status:'OPEN'}
 }],
 'tasks:completedAt':[], 'notes:createdAt':[]
};
let uid='member_1',queries=0,refreshed=0,opened=0,restored='';
const detail=new Element('article');detail.dataset.taskId='task_new';$('tasksList').append(detail);
const sdk={
 collection:(_db,...segments)=>({folder:segments.at(-1),group:segments.at(1)}),
 query:(ref,sort,limit)=>({ref,sort,limit}),
 orderBy:field=>({field}),
 limit:n=>({n}),
 getDocsFromServer:async query=>{
  queries++;
  const source=events[query.ref.folder+':'+query.sort.field]||[];
  return {docs:source.map(x=>({id:x.id,data:()=>x.data}))};
 }
};
const storageMap=new Map(),storage={
 getItem:k=>storageMap.get(k)||null,
 setItem:(k,value)=>storageMap.set(k,value)
};
const status=[];
const config={
 uid:'member_1',db:{},sdk,currentUid:()=>uid,storage,
 getGroups:async()=>[{id:'group_1',name:'群組 A',role:'EDITOR'}],
 refreshViews:async()=>{refreshed++},
 openItem:async()=>{opened++;return true},
 getCurrentTab:()=> 'Notes',restoreTab:tab=>{restored=tab},
 onStatus:text=>status.push(text)
};
$('notificationCenter').hidden=true;
$('notificationOverview').hidden=true;
$('notificationCount').hidden=true;
const app=cloudNotificationController(config);
app.start();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal($('refreshCloud').disabled,false);
assert.equal($('notificationOverview').hidden,false);
assert.equal($('notificationCount').textContent,'1');
assert.equal($('notificationCount').hidden,false);
assert.equal($('notificationList').children.length,1);
assert.equal(queries,3,'one bounded initial read per event stream');
$('toggleNotifications').onclick();
assert.equal($('notificationCenter').hidden,false);
assert.equal($('toggleNotifications').attributes['aria-expanded'],'true');
const open=$('notificationList').children[0].children[1];
await open.onclick();
assert.equal(opened,1);
assert.equal(detail.children[0]?.children[0]?.textContent,'← 返回通知');
assert.equal(detail.children[0].children[0].onclick(),true);
assert.equal(restored,'Notes');
assert.equal($('notificationCenter').hidden,false);
assert.equal($('notificationCount').hidden,true);
assert.equal($('notificationCenter').hidden,false);
assert.equal(app.returnToNotifications(),false,'returns only once to the originating list');
assert.equal(storageMap.size,1,'only per-UID read markers saved');
await $('refreshCloud').onclick();
assert.equal(refreshed,1);
assert.equal(queries,6,'manual refresh reads exactly three bounded streams');
assert.equal($('refreshCloud').disabled,false);
app.stop();
assert.equal($('notificationOverview').hidden,true);
assert.equal($('refreshCloud').disabled,true);
const prev=queries;
uid='another_member';
await $('refreshCloud').onclick();
assert.equal(queries,prev,'signed-out controller performs no reads');
console.log('INAPP_NOTIFICATION_UI_FLOATING_REFRESH_AND_UNREAD_PASS');
