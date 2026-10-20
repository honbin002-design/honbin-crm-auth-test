import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('notebook-hard-delete-v4d-test.html','utf8');
const hold=readFileSync('notebook-delete-hold-config.mjs','utf8');
const service=readFileSync('notebook-hard-delete-v4c-service.mjs','utf8');
const plan=readFileSync('notebook-hard-delete-plan.mjs','utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'MODULE_REQUIRED');
assert.match(hold,/export const firestoreReadyForRealData = false;/);
assert.match(script,/from '\.\/notebook-delete-hold-config\.mjs'/);
assert.match(script,/if\(firestoreReadyForRealData!==true\)[\s\S]*?return\}/);
assert.ok(script.indexOf('if(firestoreReadyForRealData!==true)')<script.indexOf('initializeApp(firebaseConfig)'));
assert.doesNotMatch(script,/from '\.\/notes-preview-config\.mjs'/);
assert.match(html,/id="finalizeArea" hidden/);
assert.match(html,/id="typedName"/);
assert.match(html,/id="typedPhrase"/);
assert.match(script,/service\.confirmConsoleRootRemoved\(id/);
assert.match(script,/service\.removeOwnOrphanedPointer\(pointer\.id/);
assert.match(service,/rootDeletionAuthorized:false/);
assert.doesNotMatch(html,/simple-core\.js|r73-fixes\.js|localStorage/);
for(const code of [script,service,plan]){
 const x=spawnSync(process.execPath,['--check','--input-type=module'],{input:code,encoding:'utf8'});
 assert.equal(x.status,0,x.stderr);
}
console.log('NOTEBOOK_V4D_DEPLOYED_SAFE_HOLD_PASS 14');
