import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('notebook-cross-account-readonly.html','utf8');
const js=html.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(js);
for(const needle of [
 "firebaseConfig.projectId!=='honbin-crm-notes-spark'",
 "token.claims.firebase?.sign_in_provider!=='google.com'",
 "getDocFromServer(doc(db,'groups',gid))",
 "getDocFromServer(doc(db,'groups',gid,'members',owner))",
 "getDocsFromServer(collection(db,'groups',gid,'notes'))",
 "data.ownerUid!==owner",
 "data.ownerUid===owner",
 "e.code==='permission-denied'",
 "不能證明文件不存在或資料已刪除",
 "GROUP_CHANGED_DURING_READ",
 "metadata.fromCache"
])assert.ok(js.includes(needle),needle);
for(const forbidden of ['deleteDoc','setDoc','updateDoc','writeBatch','runTransaction','addDoc','deleteField'])
 assert.ok(!new RegExp('\\b'+forbidden+'\\b').test(js),'write API prohibited: '+forbidden);
assert.ok(!/getDocsFromServer\(collection\(db,'groups'\)\)/.test(js),'no global groups list');
assert.ok(!/getDocsFromServer\(collection\(db,'users'/.test(js),'no other user index list');
const x=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
assert.equal(x.status,0,x.stderr);
console.log('NOTEBOOK_CROSS_ACCOUNT_READONLY_STATIC_PASS');
