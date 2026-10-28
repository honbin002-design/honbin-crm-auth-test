// Exercise the actual view/edit helpers with synthetic DOM and draft records.
// No Firebase SDK, network, credentials or production writes.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync('workspace-v2.html','utf8');
const fragment=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a);return html.slice(a,b)};
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.hidden=false;this.dataset={};this.value='';this.checked=false;this.textContent='';this.parentNode=null;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),contains:x=>this.classes.has(x)}}
 append(...children){for(const c of children){if(c.parentNode)c.parentNode.children=c.parentNode.children.filter(x=>x!==c);c.parentNode=this;this.children.push(c)}}
 replaceChildren(...children){for(const c of this.children)c.parentNode=null;this.children=[];this.append(...children)}
 get isConnected(){return this.root||!!this.parentNode?.isConnected}
 querySelectorAll(selector){const tags=selector.toUpperCase().split(',');return this.children.flatMap(c=>[...(tags.includes(c.tagName)?[c]:[]),...c.querySelectorAll(selector)])}
 focus(){} scrollIntoView(){}
}
const nodes=new Map(),$=id=>{if(!nodes.has(id)){const e=new Element();e.root=true;e.id=id;nodes.set(id,e)}return nodes.get(id)};
const window={};window.parent=window;
let writable=true,draft=null;
const messages=[];
const sandbox={$,window,document:{documentElement:{classList:{contains:()=>false}}},location:{origin:'https://synthetic.test'},
 requestAnimationFrame:f=>f(),mk:(tag,text='')=>Object.assign(new Element(tag),{textContent:text}),
 mayWrite:()=>writable,say:m=>messages.push(m),context:()=>({uid:'synthetic'}),session:()=>({uid:'synthetic'}),check:()=>{},drafts:{read:async()=>draft},items:[],current:null,pendingId:null};
const ctx=vm.createContext(sandbox);
vm.runInContext(fragment('function clearEditor(){','function draftSnap()')+fragment('let availableNoteDraft=null','async function loadNotes('),ctx);
const run=code=>vm.runInContext(code,ctx);
$('noteEditor').hidden=true;
ctx.note={id:'note-1',version:7,title:'檢視測試',content:'安全的合成內容'};
run('openNoteView(note)');
assert.equal($('cloudRecordView').hidden,false);
assert.equal($('cloudRecordView').dataset.mode,'view');
assert.equal($('noteEditor').hidden,true,'title opens read-only view');
assert.equal($('cloudRecordBody').querySelectorAll('input,textarea,select').length,0);
assert.equal(ctx.current,null,'view does not establish edit version');
run('editCloudRecord()');
assert.equal($('noteEditor').hidden,false,'explicit edit opens editor');
assert.equal(ctx.current.id,'note-1');assert.equal(ctx.current.version,7,'optimistic version retained');
assert.equal($('noteContent').value,'安全的合成內容');
run('clearEditor();openNoteView(note)');
writable=false;run('openNoteView(note);editCloudRecord()');
assert.equal($('cloudRecordEdit').hidden,true,'VIEWER has no edit action');
assert.equal($('noteEditor').hidden,true);
writable=true;
const home=new Element();home.root=true;
const body=new Element(),reply=new Element('textarea');reply.value='';
body.append(reply);home.append(body);ctx.body=body;
ctx.task={id:'task-1',title:'指派任務'};
run("showCloudRecord({kind:'task',item:task,body,canEdit:true})");
assert.equal(run('taskEditAllowed(task)'),false,'view cannot submit task changes');
run('editCloudRecord()');reply.value='尚未送出的回覆';
assert.equal(run('taskEditAllowed(task)'),true);
run('backCloudRecord()');
assert.equal(reply.value,'','cancel restores unsaved input');
assert.equal(run('taskEditAllowed(task)'),false);
run('backCloudRecord()');
assert.equal(body.parentNode,home,'return preserves original task list');
assert.equal($('tasksPanel').hidden,false);
draft={title:'草稿',content:'未上傳的合成草稿',active:{id:'note-1',version:7}};
await run('restoreDraft()');
assert.equal($('noteEditor').hidden,true,'restoring draft never automatically opens editor');
assert.equal($('resumeNoteDraft').hidden,false);
run('resumeNoteDraft()');
assert.equal($('noteEditor').hidden,false);
assert.equal($('noteContent').value,'未上傳的合成草稿');
assert.equal(ctx.current.version,7);
assert.equal((html.match(/if\(!taskEditAllowed\(item\)\)/g)||[]).length,3,'completion, extension and review require edit mode');
console.log('CLOUD_NOTE_TASK_READONLY_EDIT_PERMISSION_CANCEL_AND_DRAFT_PASS');
