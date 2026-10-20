import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('firestore-notebook-hard-delete-v4d-deploy.html','utf8');
const src=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
const tpl=html.match(/<textarea id="template" hidden readonly>([\s\S]*?)<\/textarea>/)?.[1];
assert.ok(src&&tpl&&tpl.length>19000,'COMPLETE_OWNER_RULES_REQUIRED');
for(const token of [
 'rules_version', '__OWNER_UID__', 'match /groups/{groupId}',
 'match /approvedAccounts/{email}', 'deleteState', 'deletionId',
 'existsAfter(', 'groupActive(', 'cleanupOwner(', 'allow delete: if false;'
])assert.ok(tpl.includes(token),'MISSING_V4D_RULES_TOKEN_'+token);
assert.match(html,/暫勿發布/);
assert.match(src,/await getDocs\(collection\(db,'approvedAccounts'\)\)/);
assert.ok(src.indexOf("await getDocs(collection(db,'approvedAccounts'))")<
 src.indexOf("currentUid=user.uid"),'VERIFY_OWNER_BEFORE_ENABLING_COPY');
assert.match(src,/getIdTokenResult\(user\)/);
assert.match(src,/sign_in_provider!=='google\.com'/);
assert.match(src,/replaceAll\('__OWNER_UID__',currentUid\)/);
assert.match(html,/id="copy" type="button" disabled/);
assert.match(html,/id="confirm" type="checkbox" disabled/);
assert.doesNotMatch(src,/setDoc\(|deleteDoc\(|updateDoc\(|firebase\.deploy|publishRules/);
assert.doesNotMatch(html,/href="https:\/\/console\.firebase\.google\.com\/project\/honbin-crm-notes-spark\/firestore\/rules"/);
const check=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:src,encoding:'utf8'});
assert.equal(check.status,0,check.stderr);
console.log('V4D_OWNER_RULES_COPY_HELPER_HOLD_PASS 16');
