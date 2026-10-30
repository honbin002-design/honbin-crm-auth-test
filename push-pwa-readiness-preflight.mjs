import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const manifest=JSON.parse(readFileSync('workspace-manifest.webmanifest','utf8'));
const icon=readFileSync('pwa-icon.svg','utf8');
const page=readFileSync('workspace-v2.html','utf8');
const sw=readFileSync('push-sw.js','utf8');
assert.equal(manifest.display,'standalone');
assert.equal(manifest.scope,'/honbin-crm-auth-test/');
assert.equal(manifest.start_url,'/honbin-crm-auth-test/workspace-v2.html');
assert.match(icon,/<svg/);
assert.match(page,/rel="manifest"/);
assert.match(page,/id="checkPush"/);
assert.match(page,/id="pushStatus"/);
assert.match(page,/navigator\.serviceWorker\.register/);
assert.match(page,/async function openPushDeepLink\(\)/);
assert.match(page,/groupItems\.find\(x=>x\.id===groupId\)/);
assert.match(page,/await loadNotes\(\);check\(s\)/);
assert.match(page,/await loadTasks\(\);check\(s\)/);
assert.match(page,/function scrollCloudRecord\(\)/);
assert.match(page,/HONBIN_CLOUD_RECORD_VIEW/);
assert.match(page,/if\(note\)openNoteView\(note\)/);
assert.match(page,/if\(!standalone\)/);
assert.doesNotMatch(page,/Notification\.requestPermission\(/);
assert.doesNotMatch(page,/\.pushManager\.subscribe\(/);
assert.doesNotMatch(sw,/fetch\(|getToken\(|firebasejs/);
assert.doesNotMatch(sw,/indexedDB|caches\.open/);
const events=new Map(),shown=[],opened=[];
const self={
 location:{origin:'https://honbin002-design.github.io'},
 addEventListener(name,callback){events.set(name,callback)},
 registration:{showNotification:async(title,options)=>{shown.push({title,options})}},
 skipWaiting:async()=>true,clients:{
  claim:async()=>true,matchAll:async()=>[],
  openWindow:async path=>opened.push(path)
 }
};
vm.runInNewContext(sw,{self,URL,URLSearchParams},{timeout:500});
assert.ok(events.has('push'));assert.ok(events.has('notificationclick'));
async function simulate(data){
 let operation;
 events.get('push')({data:data===null?null:{json:()=>data},waitUntil(p){operation=p}});
 await operation;return shown.at(-1);
}
const task=await simulate({kind:'TASK_ASSIGNED',groupId:'gid_123',taskId:'task_123',
 content:'secret client data',email:'private@example.com'});
assert.equal(task.title,'有新任務指派');
assert.ok(task.options.data.url.startsWith('/honbin-crm-auth-test/workspace-v2.html?tab=Tasks'));
assert.ok(!JSON.stringify(task).includes('secret client data'));
assert.ok(!JSON.stringify(task).includes('private@example.com'));
const note=await simulate({kind:'SHARED_NOTE_CREATED',groupId:'gid_123',noteId:'note_123'});
assert.equal(note.title,'新增共用記事');
assert.ok(note.options.data.url.includes('tab=Notes'));
const order=await simulate({kind:'ORDER_UPDATED',groupId:'gid_123',orderId:'order_123',
 eventDocId:'event_2',revision:2,content:'private business detail'});
assert.equal(order.title,'訂貨資料已修改');
assert.ok(order.options.data.url.includes('tab=Orders'));
assert.ok(order.options.data.url.includes('orderId=order_123'));
assert.ok(order.options.tag.endsWith('event_2'));
assert.ok(!JSON.stringify(order).includes('private business detail'));
const prior=await simulate({kind:'ORDER_UPDATED',groupId:'gid_123',orderId:'order_123',
 eventDocId:'event_1',revision:1});
assert.notEqual(prior.options.tag,order.options.tag);
const editedNote=await simulate({kind:'SHARED_NOTE_UPDATED',groupId:'gid_123',
 noteId:'note_123',eventDocId:'event_3',revision:3});
assert.equal(editedNote.title,'共用記事已修改');
const invalid=await simulate({kind:'TASK_ASSIGNED',groupId:'../../hack',taskId:'task_123'});
assert.equal(invalid.options.data.url,'/honbin-crm-auth-test/workspace-v2.html');
const empty=await simulate(null);
assert.equal(empty.title,'鴻繽記事與任務有新通知');
let operation;
events.get('notificationclick')({
 notification:{data:{url:'https://evil.invalid'},close(){}},
 waitUntil(p){operation=p}
});
await operation;
assert.equal(opened.at(-1),'/honbin-crm-auth-test/workspace-v2.html');
events.get('notificationclick')({
 notification:{data:{url:task.options.data.url},close(){}},
 waitUntil(p){operation=p}
});
await operation;
assert.equal(opened.at(-1),task.options.data.url);
console.log('PWA_STANDALONE_PUSH_HANDLER_NO_SECRETS_TEST_PASS');

