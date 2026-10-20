import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('notebook-owner-readonly-inventory.html','utf8');
const js=html.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(js);
for(const needle of [
 "firebaseConfig.projectId!=='honbin-crm-notes-spark'",
 "getDocsFromServer(collection(db,'approvedAccounts'))",
 "getDocsFromServer(collection(db,'users',owner,'groupIndex'))",
 "group.data().ownerUid===owner",
 "group.data().ownerUid!==owner",
 "getDocsFromServer(collection(db,'groups',book.id,'notes'))",
 "getDocsFromServer(collection(db,'groups',book.id,'members'))",
 "getDocsFromServer(collection(db,'groups',book.id,'sentInvites'))",
 "getDocFromServer(doc(db,'groups',book.id))",
 "metadata.fromCache",
 "唯讀盤點：PASS（不是永久刪除驗收）"
])assert.ok(js.includes(needle),needle);
for(const forbidden of ['deleteDoc','setDoc','updateDoc','writeBatch','runTransaction','addDoc','deleteField'])
 assert.ok(!new RegExp('\\b'+forbidden+'\\b').test(js),'write API prohibited: '+forbidden);
const x=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
assert.equal(x.status,0,x.stderr);
console.log('NOTEBOOK_OWNER_READONLY_INVENTORY_STATIC_PASS');
