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
let page='Notes',returnPage='Notes',controller=null;
function switchPage(name,{fromNotification=false}={}){
 if(name!=='Notifications'&&!fromNotification)returnPage=name;
 for(const tab of ['Notes','Tasks','Notifications','Settings']){
  const panel=tab==='Notifications'?'notificationOverview':tab.toLowerCase()+'Panel';
  $(panel).hidden=tab!==name;
 }
 $('notificationCenter').hidden=name!=='Notifications';
 page=name;controller?.onTabChange(name);
}
globalThis.window={scrollY:340,location:{origin:'https://example.test'},
 scrollTo({top}){this.scrollY=top}};
window.parent=window;
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
 openItem:async()=>{opened++;switchPage('Tasks',{fromNotification:true});window.scrollY=875;return true},
 getCurrentTab:()=>page,
 restoreTab:tab=>{restored=tab;switchPage(tab)},
 openNotifications:()=>switchPage('Notifications'),
 closeNotifications:()=>switchPage(returnPage),
 onStatus:text=>status.push(text)
};
$('notificationCenter').hidden=true;
$('notificationOverview').hidden=true;
$('notificationCount').hidden=true;
const app=cloudNotificationController(config);
controller=app;
app.start();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal($('refreshCloud').disabled,false);
assert.equal($('notificationOverview').hidden,true,'notice page hidden when showing Notes');
assert.equal($('notesPanel').hidden,false,'Notes alone visible initially');
assert.equal($('notificationCount').textContent,'1');
assert.equal($('notificationCount').hidden,false);
assert.equal($('notificationList').children.length,1);
assert.equal(queries,6,'one bounded initial read per event stream');
switchPage('Notifications');
assert.equal($('notificationCenter').hidden,false);
assert.equal($('notificationOverview').hidden,false);
assert.equal($('notesPanel').hidden,true,'opening notice shows a separate page');
assert.equal($('tasksPanel').hidden,true);
assert.equal($('settingsPanel').hidden,true);
const open=$('notificationList').children[0].children[1];
await open.onclick();
assert.equal(opened,1);
assert.equal($('notificationOverview').hidden,true,'detail page hides notifications');
assert.equal($('tasksPanel').hidden,false);
assert.equal(detail.children[0]?.children[0]?.textContent,'← 返回通知');
assert.equal(detail.children[0].children[0].onclick(),true);
assert.equal(page,'Notifications');
assert.equal($('tasksPanel').hidden,true);
assert.equal($('notificationOverview').hidden,false);
assert.equal(window.scrollY,340,'return restores the notification scroll position');
assert.equal($('notificationCenter').hidden,false);
assert.equal($('notificationCount').hidden,true);
assert.equal($('notificationCenter').hidden,false);
assert.equal(app.returnToNotifications(),false,'returns only once to the originating list');
$('toggleNotifications').onclick();
assert.equal(page,'Notes','notification page back restores the previous feature page');
assert.equal($('notificationOverview').hidden,true,'notice list never remains on Notes page');
assert.equal($('notesPanel').hidden,false);
switchPage('Notifications');
switchPage('Settings');
assert.equal($('notificationOverview').hidden,true,'switching to Settings always hides notices');
assert.equal($('settingsPanel').hidden,false);
switchPage('Notes');
assert.equal(storageMap.size,1,'only per-UID read markers saved');
await $('refreshCloud').onclick();
assert.equal(refreshed,1);
assert.equal(queries,12,'manual refresh reads exactly six bounded streams');
assert.equal($('refreshCloud').disabled,false);
app.stop();
assert.equal($('notificationOverview').hidden,true);
assert.equal($('refreshCloud').disabled,true);
// A deleted or no-longer-authorized notification must return to the
// dedicated notification page without making its content visible.
const inaccessible=cloudNotificationController({
 ...config,openItem:async()=>{switchPage('Tasks',{fromNotification:true});return false}
});
controller=inaccessible;inaccessible.start();
await new Promise(resolve=>setTimeout(resolve,0));
switchPage('Notifications');
await $('notificationList').children[0].children[1].onclick();
assert.equal(page,'Notifications','missing notification returns to the dedicated inbox');
assert.equal($('notificationOverview').hidden,false);
assert.equal($('tasksPanel').hidden,true);
inaccessible.stop();
// An order notice opens within the same workspace and offers a return action.
events['orders:updatedAt']=[{id:'order_new',data:{createdBy:'author_2',updatedBy:'author_2',
 revision:1,updatedAt:millis(Date.now()-1000)}}];
const orderInbox=cloudNotificationController({...config,
 openItem:async item=>{assert.equal(item.tab,'Orders');switchPage('Orders',{fromNotification:true});return true}
});
controller=orderInbox;orderInbox.start();
await new Promise(resolve=>setTimeout(resolve,0));
switchPage('Notifications');
const orderRow=$('notificationList').children.find(row=>row.children[0].children[0].textContent.includes('訂貨'));
assert.ok(orderRow,'order update appears in the inbox');
await orderRow.children[1].onclick();
assert.equal(page,'Orders');
assert.equal($('ordersPanel').children[0].children[0].onclick(),true);
assert.equal(page,'Notifications');
orderInbox.stop();
const prev=queries;
uid='another_member';
await $('refreshCloud').onclick();
assert.equal(queries,prev,'signed-out controller performs no reads');
console.log('INAPP_NOTIFICATION_UI_FLOATING_REFRESH_AND_UNREAD_PASS');
