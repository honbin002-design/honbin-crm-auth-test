import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('notebook-v4d-target-cleanup-phase1.html','utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'SCRIPT_REQUIRED');
const expect=[
/const TARGET='v4d_test_efbbf2dced534cb5a6f1d117023fd069'/,
/const NAME='V4D_永久刪除測試_023fd069'/,
/getDocsFromServer\(sdk\.collection\(db,'approvedAccounts'\)\)/,
/token\.claims\.firebase\?\.sign_in_provider!=='google\.com'/,
/getDocFromServer\(sdk\.doc\(db,'groups',TARGET\)\)/,
/getDocFromServer\(sdk\.doc\(db,'users',uid,'groupIndex',TARGET\)\)/,
/test_note_01/,
/test_note_02/,
/members\.size\|\|invites\.size/,
/const p=await service\.preview\(TARGET\)/,
/ready=false;await scan\(\);guard\(\)/,
/service\.lock\(TARGET,\{typedName:NAME,deletionId\}\)/,
/service\.runCleanup\(TARGET,lockedEpoch/,
/ownerPointerRetained/,
/CONTENT_CLEANED_ROOT_LOCKED/,
/!confirm\(warning\)/,
/typedPhrase'\)\.value!=='永久刪除'/,
/await getIdTokenResult\(user\)/,
/service=notebookHardDeleteV4C/,
/此頁不提供主文件刪除功能/
];
for(const re of expect)assert.match(re.source.includes('此頁')?html:script,re);
assert.doesNotMatch(script,/deleteDoc\(|removeOwnOrphanedPointer|confirmConsoleRootRemoved|window\.location\.assign/);
assert.doesNotMatch(script,/localStorage|sessionStorage|setDoc\(|writeBatch\(/);
assert.doesNotMatch(html,/href="https:\/\/console\.firebase\.google\.com/);
const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});
assert.equal(check.status,0,check.stderr);
console.log('V4D_TARGET_PHASE1_EXACT_SCOPE_PASS '+(expect.length+4));
