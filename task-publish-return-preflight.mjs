// Browser-independent integration regression of the ACTUAL task-submit handler.
// All Firestore writes are synthetic; never connects to production Firebase.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync('workspace-v2.html','utf8');
function fragment(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert(a>=0&&b>a,'source fragment found: '+start);
 return html.slice(a,b);
}
const helpers=fragment('function setTaskForm(open){',"$('toggleTaskForm').onclick=");
const handler=fragment("$('taskForm').onsubmit=e=>{",'
async function checkPushReadiness()');
function createHarness(failRefresh=false){
 let resolveWrite,rejectWrite,operation=null,creations=0,ids=0,confirmationCount=0,refreshCount=0;
 const write=new Promise((res,rej)=>{resolveWrite=res;rejectWrite=rej});
 const messages=[],announcements=[],opened=[],elements=new Map();
 function node(id){
  if(!elements.has(id))elements.set(id,{id,hidden:false,value:'',textContent:'',
   disabled:false,className:'',setAttribute(name,val){this[name]=val}});
  return elements.get(id);
 }
 node('taskTitle').value='通知測試';
 node('taskDetail').value='一次發布只需建立一次';
 node('taskExecuteDate').value='2026-10-24';
 node('taskDue').value='2026-10-24';
 node('taskForm').reset=()=>{
  for(const id of ['taskTitle','taskDetail','taskAssignee','taskExecuteDate','taskDue'])
   node(id).value='';
 };
 node('taskSearch').value='測試過濾';
 node('taskSearchField').value='content';
 const window={parent:{postMessage:(payload,origin)=>messages.push({payload,origin})}};
 const sandbox={
  window,location:{origin:'https://example.test'},
  document:{documentElement:{classList:{contains:key=>key==='embedded'}}},
  TASK_RULES_ENABLED:true,TASK_V3_RULES_ENABLED:true,
  taskSelected:{id:'group-test',name:'鴻繽',role:'EDITOR'},
  $:node,confirm:()=>{confirmationCount++;return true},
  tasks:{
   newId:()=>{ids++;return 'task_id_1'},
   create:async payload=>{creations++;await write;return {alreadyCreated:false,payload}}
  },
  say:m=>announcements.push(m),session:()=>({uid:'test'}),
  check:()=>{},tab:(name,opts)=>opened.push({name,opts}),
  loadTasks:async()=>{refreshCount++;if(failRefresh)throw Error('synthetic refresh failure')},
  console
 };
 const ctx=vm.createContext(sandbox);
 vm.runInContext(`let busy=false,pendingTaskWrite=null,taskPublishSubmitting=false;
let taskStatus='DONE',taskPageIndex=3,taskPageData={cached:true},taskFocused=true;
async function run(action){
 if(busy)return;
 busy=true;
 try{await action()}catch(e){say('操作未完成：'+String(e.message||e))}
 finally{busy=false}
}
`+helpers+handler,ctx);
 return {ctx,node,messages,announcements,opened,
  submit(){node('taskForm').onsubmit({preventDefault(){}})},
  resolveWrite,rejectWrite,
  get state(){return {creations,ids,confirmationCount,refreshCount,
   taskStatus:vm.runInContext('taskStatus',ctx),
   pendingTaskWrite:vm.runInContext('pendingTaskWrite',ctx),
   taskPublishSubmitting:vm.runInContext('taskPublishSubmitting',ctx),
   busy:vm.runInContext('busy',ctx)}}};
}
async function flush(){await new Promise(resolve=>setImmediate(resolve))}
{
 const t=createHarness();
 t.submit();t.submit();t.submit();
 assert.equal(t.state.creations,1,'three immediate taps create one write');
 assert.equal(t.state.ids,1,'same task ID');
 assert.equal(t.state.confirmationCount,1,'one confirmation');
 assert.equal(t.state.taskPublishSubmitting,true,'submit locked before first await');
 t.resolveWrite();await flush();await flush();
 assert.equal(t.state.creations,1);
 assert.equal(t.state.taskStatus,'OPEN','task screen always resets to active task list');
 assert.equal(t.node('taskForm').hidden,true,'editor collapsed after server confirmation');
 assert.equal(t.node('taskTitle').value,'','stale text no longer re-publishable');
 assert.equal(t.node('taskPublishFeedback').hidden,false,'success notice persists');
 assert.match(t.node('taskPublishFeedback').textContent,/任務發布成功/);
 assert.deepEqual(t.messages.map(x=>x.payload.type),['HONBIN_CLOUD_TASK_PUBLISHED']);
 assert.equal(t.state.refreshCount,1,'list refreshed once');
 assert.equal(t.state.taskPublishSubmitting,false,'lock released after success');
 assert.equal(t.state.pendingTaskWrite,null,'confirmed ID cleared');
 assert.equal(t.opened[0].name,'Tasks');
}
{
 const t=createHarness(true);
 t.submit();t.resolveWrite();await flush();await flush();
 assert.equal(t.state.creations,1);
 assert.equal(t.node('taskForm').hidden,true,'failed refresh must not re-open editor');
 assert.match(t.node('taskPublishFeedback').textContent,/不要重新發布/);
 assert.equal(t.messages.length,1,'still return to Tasks after refresh failure');
}
{
 const t=createHarness();
 t.submit();t.rejectWrite(Error('synthetic network'));await flush();await flush();
 assert.equal(t.state.pendingTaskWrite.id,'task_id_1');
 assert.equal(t.state.taskPublishSubmitting,false,'retry unlocked after uncertain result');
 t.submit();await flush();
 assert.equal(t.state.ids,1,'same ID on uncertain retry, not a duplicate');
}
console.log('TASK_PUBLISH_SINGLE_SUBMISSION_RETURN_TO_LIST_AND_RETRY_ID_PASS');
