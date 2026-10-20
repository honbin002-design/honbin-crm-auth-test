import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const s=readFileSync('firestore-notebook-archive-v3-deploy.html','utf8');
const start=s.indexOf('<textarea id="template" hidden readonly>');
const end=s.indexOf('</textarea>',start);
assert.ok(start>=0&&end>start+16000,'COMPLETE_ARCHIVE_RULES_REQUIRED');
const template=s.slice(start,end);
for(const token of ['rules_version','__OWNER_UID__','groupIsActive','archivedAt','approvedAccounts','allow delete: if false']){
 assert.ok(template.includes(token),'MISSING_RULE_TOKEN_'+token);
}
assert.ok(s.includes("await getDocs(collection(db,'approvedAccounts'))"),'LIVE_OWNER_READBACK_REQUIRED');
assert.ok(s.indexOf("await getDocs(collection(db,'approvedAccounts'))")<s.indexOf('currentUid=user.uid'),'OWNER_GATE_BEFORE_UID');
assert.ok(s.includes("getIdTokenResult(user)"),'GOOGLE_VERIFICATION_REQUIRED');
assert.ok(s.includes("replaceAll('__OWNER_UID__',currentUid)"),'OWNER_TOKEN_SUBSTITUTION_REQUIRED');
assert.ok(s.includes('id="copy" type="button" disabled'),'COPY_MUST_START_DISABLED');
assert.ok(s.includes('id="confirm" type="checkbox" disabled'),'OWNER_CONFIRM_REQUIRED');
assert.ok(s.includes('honbin-crm-notes-spark'),'EXPECTED_FIREBASE_PROJECT');
const module=s.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(module,'MODULE_SCRIPT_MISSING');
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:module[1],encoding:'utf8'});
assert.equal(syntax.status,0,syntax.stderr);
console.log('ARCHIVE_V3_DEPLOY_HELPER_PASS 14');
