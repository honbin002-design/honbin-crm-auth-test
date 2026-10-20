import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('notebook-private-viewer-denial-test.html','utf8');
const js=html.split('<script type="module">')[1]?.split('</script>')[0];assert.ok(js);
for(const term of [
 "GROUP='D0iiTJNmLt5tIs64sTL6'","RECIPIENT='wind99vic@gmail.com'",
 "member.data().role!=='VIEWER'","member.data().status!=='ACTIVE'",
 "group.data().ownerUid===uid",
 "getDocs(collection(db,'users',ownerUid,'notes'))",
 "if(error?.code!=='permission-denied')throw error",
 "if(before.exists())throw Error('TEST_PATH_MUST_NOT_EXIST')",
 "if(after.exists())throw Error('UNEXPECTED_TEST_DOCUMENT_PRESENT')",
 "await updateDoc(ref,{title:","await deleteDoc(ref)",
 "if(!denied)throw Error('OPERATION_NOT_DENIED_BY_FIRESTORE')",
 "if(!actor||busy||!privatePassed||attempted)return",
 "PRIVATE_NOTES_ISOLATION_SERVER_PASS","VIEWER_UPDATE_DELETE_DENIED_SERVER_PASS",
 "onAuthStateChanged(auth,async user","crypto.randomUUID()"
])assert.ok(js.includes(term),term);
for(const forbidden of ['setDoc','addDoc','writeBatch','runTransaction','collectionGroup','enableIndexedDbPersistence','deleteField'])
 assert.ok(!new RegExp('\\b'+forbidden+'\\b').test(js),'unexpected write or scope: '+forbidden);
assert.equal((js.match(/await updateDoc\(/g)||[]).length,1);
assert.equal((js.match(/await deleteDoc\(/g)||[]).length,1);
assert.ok(js.includes("if(operation==='update')")&&js.includes("else if(operation==='delete')"));
assert.ok(!js.includes("getDocs(collection(db,'groups'"),'do not enumerate unrelated groups');
assert.ok(html.includes('絕不對任何既有記事執行修改或刪除'));
const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
assert.equal(check.status,0,check.stderr);
console.log('PRIVATE_AND_VIEWER_DENIAL_SCOPED_STATIC_PASS');
