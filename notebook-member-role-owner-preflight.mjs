import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('notebook-member-role-owner-test.html','utf8');
const js=html.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(js);
for(const term of [
 "GROUP='D0iiTJNmLt5tIs64sTL6'","OWNER='honbin002@gmail.com'",
 "RECIPIENT='wind99vic@gmail.com'","group.data().ownerUid!==uid",
 "group.data().name!==NAME","x.data().status==='ACTIVE'",
 "accepted.some(inv=>inv.id===x.data().invitationId)",
 "if(candidates.length!==1)throw Error('EXACT_ACCEPTED_MEMBER_NOT_UNIQUE')",
 "if(current.uid!==verified.uid||current.role!==verified.role)",
 "await updateDoc(current.ref,{role})",
 "if(after.uid!==current.uid||after.role!==role)",
 "if(!actor||!verified||busy||attempted",
 "MEMBER_ROLE_CHANGE_SERVER_PASS","OWNER_MEMBER_SCOPE_READONLY_PASS",
 "onAuthStateChanged(auth,async user"
])assert.ok(js.includes(term),term);
for(const forbidden of ['deleteDoc','setDoc','writeBatch','runTransaction','addDoc','collectionGroup'])
 assert.ok(!new RegExp('\\b'+forbidden+'\\b').test(js),'unexpected write '+forbidden);
assert.equal((js.match(/await updateDoc\(/g)||[]).length,1,'only one role write');
assert.ok(html.includes('不會自動改權限'));
const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
console.log('OWNER_SCOPED_MEMBER_ROLE_STATIC_PASS');
