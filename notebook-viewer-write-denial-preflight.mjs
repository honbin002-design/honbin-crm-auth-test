import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('notebook-viewer-write-denial-test.html','utf8');
const js=html.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(js);
for(const term of ["GROUP='D0iiTJNmLt5tIs64sTL6'","RECIPIENT='wind99vic@gmail.com'",
 "membership.data().role!=='VIEWER'","membership.data().status!=='ACTIVE'",
 "root.data().ownerUid===uid","if(!actor||!ready||!audited||busy||attempted)return",
 "liteGetDoc(ref)","await liteSetDoc(ref,{ownerUid:uid,groupId:GROUP,",
 "error?.code!=='permission-denied'","!writeRejected||after.exists()",
 "VIEWER_WRITE_DENIED_SERVER_PASS","$('probe').addEventListener('click',probe)","$('audit').addEventListener('click',audit)","liteGetDocs(liteCollection(liteDb,'groups',GROUP,'notes'))","!audited||busy||attempted","watchdog=setTimeout"])
 assert.ok(js.includes(term),term);
for(const forbidden of ['deleteDoc','updateDoc','writeBatch','runTransaction','addDoc','setPersistenceLocal'])assert.ok(!new RegExp('\\b'+forbidden+'\\b').test(js),'forbidden operation '+forbidden);
assert.equal((js.match(/\bliteSetDoc\(/g)||[]).length,1,'exactly one Lite SDK write attempt');
assert.equal((js.match(/\bsetDoc\(/g)||[]).length,0,'no buffered full SDK writes');
assert.ok(js.includes('audited=true;ready=true'),'readonly recovery before write');
assert.ok(html.includes('若安全規則異常允許'));
assert.ok(!/setDoc\(.+?\)(?![\s\S]*probe)/.test(''),'sanity');
const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
console.log('VIEWER_DENY_SCOPED_STATIC_PASS');
