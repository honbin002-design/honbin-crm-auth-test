import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {taskCanComplete} from './firebase-task-service.mjs';
const page=readFileSync('workspace-v2.html','utf8');
const service=readFileSync('firebase-task-service.mjs','utf8');
const rules=readFileSync('firestore-tasks-v2-rules-REVIEW-ONLY.rules','utf8');
const inline=page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline,'module script required');
const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:inline,encoding:'utf8'});
assert.equal(syntax.status,0,syntax.stderr);
assert.match(page,/firestoreReadyForRealData/);
assert.match(page,/projectId!=='honbin-crm-notes-spark'/);
assert.match(page,/taskPublish" disabled/);
assert.match(page,/只有你明確按「發布」並確認才會寫入/);
assert.match(page,/firebase-note-service\.mjs/);
assert.match(page,/firebase-group-service\.mjs/);
assert.match(page,/firebase-offline-drafts\.mjs/);
assert.match(page,/id="privateNotes"/);
assert.match(page,/id="sharedNotes"/);
assert.match(page,/id="taskGroup"/);
assert.match(page,/id="taskExecuteDate"/);
assert.match(page,/const PROFILE_RULES_ENABLED=true/);
assert.match(page,/const TASK_RULES_ENABLED=true/);
assert.match(page,/ownerMembers\.roster\(taskGroupId\)/);
assert.match(page,/verifiedRoster=new Map/);
assert.match(page,/m\.editable&&m\.status==='ACTIVE'&&m\.email/);
assert.match(page,/if\(ownerMembers&&!verifiedEmail\)\{opt\.disabled=true/);
assert.doesNotMatch(page,/name\|\|'未設定暱稱（成員）'/);
assert.match(page,/let verifiedRoster=null; \/\/ Server-verified invitation email mapping/);
assert.match(page,/verifiedRoster\?\.get\(id\)/);
assert.match(page,/auth\?\.currentUser\?\.email/);
assert.match(page,/成員（UID /);
assert.doesNotMatch(page,/return \(await nicknameFor\(id\)\.catch\(\(\)=>''\)\)\|\|'未設定暱稱'/);


assert.match(page,/TEST 共用暱稱已開放/);
assert.match(service,/getDocFromServer\(ref\)/);
assert.match(service,/NICKNAME_SERVER_READBACK_MISMATCH/);
assert.match(page,/const TASK_RULES_ENABLED=true/);
assert.match(page,/id="checkLiveRules"/);
assert.match(page,/id="liveRulesStatus"/);
assert.match(page,/async function checkLiveRulesReadOnly\(\)/);
assert.match(page,/sdk\.getDocFromServer\(/);
assert.match(page,/sdk\.getDocsFromServer\(/);
assert.match(page,/groups\.listGroups\(\)/);
assert.match(page,/尚未驗收寫入／越權拒絕／實際推播/);
assert.match(page,/firestore-live-denial-probes\.mjs/);
assert.match(page,/id="checkLiveDenials"/);
assert.match(page,/id="liveDenialsStatus"/);
assert.match(page,/verifyLiveReadDenials\(/);
assert.match(page,/三項伺服器越權讀取拒絕 PASS/);


assert.match(page,/if\(!authenticated&&name!=='Settings'\)/);
assert.doesNotMatch(page,/localStorage\.setItem/);
assert.match(page,/id="settingsPanel"/);
assert.match(page,/id="loginBox"/);
assert.match(page,/id="inviteManagement" hidden/);
assert.match(page,/id="receivedInviteManagement" hidden/);
assert.match(page,/id="inviteForm" hidden/);
assert.match(page,/id="inviteGroup"/);
assert.match(page,/id="refreshReceived"/);
assert.match(page,/groups\.listInbox\(\)/);
assert.match(page,/groups\.acceptInvite\(invitation\)/);
assert.match(page,/groups\.sendInvite\(groupId,recipient,role\)/);
assert.match(page,/groups\.listSentInvites\(groupId\)/);
assert.match(page,/groups\.myRole\(groupId\)!=='ADMIN'/);
assert.match(page,/g\.role==='ADMIN'/);
assert.match(page,/INVITATION_ALREADY_PENDING_OR_ACCEPTED/);
assert.match(page,/INVITE_READBACK_UNCONFIRMED/);
assert.match(page,/root\.replaceChildren\(\)/);

assert.match(page,/taskSelected\.id/);
assert.match(service,/executeDate/);
assert.match(rules,/request\.resource\.data\.executeDate/);
assert.match(rules,/request\.auth\.uid == profileUid/);
assert.match(service,/serverTimestamp\(\)/);
assert.match(service,/taskCanComplete\(before,uid\)/);
assert.match(page,/pendingTaskWrite/);
assert.match(page,/fingerprint:|fingerprint,id:tasks\.newId/);
assert.match(page,/任務暫時不能刪除/);
assert.match(page,/\$\('toggleTaskForm'\)\.hidden=!canPublish/);
assert.match(service,/TASK_CREATE_SERVER_READBACK_MISMATCH/);
assert.match(service,/TASK_COMPLETE_SERVER_READBACK_MISMATCH/);
assert.match(service,/TASK_ID_CONFLICT_STOP/);
assert.match(service,/getDocsFromServer\(taskRef\(groupId\)\)/);


// Guard review-only rule fragments against corruption/truncation and
// accidentally publishing a noncompiling or duplicated match block.
const codeOnly=rules.split('\n').map(line=>line.split('//')[0]).join('\n');
assert.equal((codeOnly.match(/match \/profiles\/\{profileUid\}/g)||[]).length,1);
assert.equal((codeOnly.match(/match \/tasks\/\{taskId\}/g)||[]).length,1);
assert.equal((codeOnly.match(/allow create:/g)||[]).length,2);
assert.equal((codeOnly.match(/allow update:/g)||[]).length,2);
assert.equal((codeOnly.match(/allow delete: if false;/g)||[]).length,2);
assert.ok(!codeOnly.includes('rules_version ='),'review fragment must not be full rules');
let depth=0, inString=false, quote='', escape=false;
for(const c of codeOnly){
 if(inString){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote){inString=false;quote=''}continue}
 if(c==='\''||c==='"'){inString=true;quote=c;continue}
 if(c==='{')depth++;
 if(c==='}') {depth--;assert.ok(depth>=0,'too many closing braces')}
}
assert.equal(inString,false,'unterminated quoted rule literal');
assert.equal(depth,0,'unbalanced Firestore rule fragment');
assert.match(codeOnly,/request\.resource\.data\.executeDate\.matches\('/);
assert.match(codeOnly,/request\.resource\.data\.dueDate\.matches\('/);

assert.match(rules,/NOT DEPLOYED/);
assert.match(rules,/completedBy == request\.auth\.uid/);
assert.match(rules,/completedAt == request\.time/);
assert.match(rules,/resource\.data\.status == 'OPEN'/);
assert.match(rules,/allow delete: if false/);
assert.equal(taskCanComplete({status:'OPEN',assignedUid:null},'uidA'),true);
assert.equal(taskCanComplete({status:'OPEN',assignedUid:'uidA'},'uidA'),true);
assert.equal(taskCanComplete({status:'OPEN',assignedUid:'uidA'},'uidB'),false);
assert.equal(taskCanComplete({status:'DONE',assignedUid:null},'uidA'),false);
assert.equal(taskCanComplete({status:'OPEN',assignedUid:null},''),false);
console.log('WORKSPACE_V2_STATIC_GATES_PASS');
