import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('notebook-invite-exact-test.html','utf8');
const js=html.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(js);
for(const s of [
 "GROUP='D0iiTJNmLt5tIs64sTL6'","NAME='測試共用記事'","RECIPIENT='wind99vic@gmail.com'","ROLE='VIEWER'",
 "getDocsFromServer(collection(db,'approvedAccounts'))",
 "getDocFromServer(doc(db,'groups',GROUP))",
 "getDocsFromServer(collection(db,'groups',GROUP,'sentInvites'))",
 "getDocsFromServer(collection(db,'groups',GROUP,'members'))",
 "getDocFromServer(doc(db,'inboxes',RECIPIENT,'invites',item.id))",
 "EXISTING_PENDING_INVITE_NO_DUPLICATE",
 "INVITE_ALREADY_ACCEPTED",
 "MEMBERS_PRESENT_MANUAL_REVIEW_REQUIRED",
 "await preflight(owner,epoch)",
 "await batch.commit()",
 "batch.set(doc(db,'groups',GROUP,'sentInvites',ref.id)"
])assert.ok(js.includes(s),s);
for(const forbidden of ['deleteDoc','updateDoc','runTransaction','addDoc','deleteField'])
 assert.ok(!new RegExp('\\b'+forbidden+'\\b').test(js),'prohibited: '+forbidden);
assert.equal((js.match(/batch\.set\(/g)||[]).length,2,'exactly two writes');
assert.ok(!/batch\.delete|batch\.update|setDoc\(/.test(js),'no extra writes');
const x=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
assert.equal(x.status,0,x.stderr);
console.log('NOTEBOOK_INVITE_EXACT_TEST_STATIC_PASS');
