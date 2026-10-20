import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('notebook-v4d-invite-accept-test.html','utf8');
const js=html.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(js);
for(const v of [
 "const GROUP='D0iiTJNmLt5tIs64sTL6'",
 "const NAME='測試共用記事'",
 "const OWNER='Iy5BWeZ17KW3Ost0m38LEhcj09F3'",
 "const RECIPIENT='wind99vic@gmail.com'",
 "if(actor.uid===OWNER)return 'owner'",
 "if(actor.email===RECIPIENT)return 'recipient'",
 "getDocsFromServer(collection(db,'groups',GROUP,'sentInvites'))",
 "getDocsFromServer(collection(db,'inboxes',RECIPIENT,'invites'))",
 "getDocFromServer(doc(db,'groups',GROUP))",
 "groupId:GROUP,recipientEmail:RECIPIENT,role:'VIEWER',status:'PENDING',invitedBy:OWNER",
 "batch.update(doc(db,'inboxes',RECIPIENT,'invites',id),{status:'ACCEPTED',acceptedUid:u})",
 "batch.set(memberRef,{uid:u,role:'VIEWER',status:'ACTIVE',invitationId:id})",
 "const p=await getDocFromServer(pointer)",
 "metadata.fromCache"
])assert.ok(js.includes(v),v);
for(const forbidden of ['deleteDoc','deleteField','runTransaction','updateDoc','addDoc'])
 assert.ok(!new RegExp('\\b'+forbidden+'\\b').test(js),'unexpected API: '+forbidden);
assert.ok(!js.includes('firebaseConfig.firestoreReadyForRealData=true'));
const c=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
assert.equal(c.status,0,c.stderr);
console.log('V4D_INVITE_ACCEPT_SCOPED_STATIC_PASS');
