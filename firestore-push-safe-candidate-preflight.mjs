import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareTestPushCandidate} from './firestore-push-safe-candidate.mjs';
import {mergeTestTaskAndNicknameRules} from './firestore-task-nickname-offline-merge.mjs';
const html=readFileSync('firestore-notebook-hard-delete-v4d-deploy.html','utf8');
const raw=html.match(/<textarea id="template"[^>]*>([\s\S]*?)<\/textarea>/)?.[1];
assert.ok(raw);
const baseline=raw.replaceAll('&amp;','&').replaceAll('&lt;','<')
 .replaceAll('&gt;','>').replaceAll('&quot;','"')
 .replaceAll('__OWNER_UID__','synthetic_owner');
const task=readFileSync('firestore-tasks-v2-rules-REVIEW-ONLY.rules','utf8');
const push=readFileSync('firestore-push-subscriptions-REVIEW-ONLY.rules','utf8');
const fresh=prepareTestPushCandidate(baseline,task,push);
assert.equal(fresh.exactOriginalPreserved,true);
assert.equal(fresh.existingTaskAndNickname,false);
assert.equal(fresh.added.length,3);
assert.equal((fresh.merged.match(/match \/pushSubscriptions\/\{subscriberUid\}\/devices\/\{deviceId\}/g)||[]).length,1);
assert.equal((fresh.merged.match(/match \/tasks\/\{taskId\}/g)||[]).length,1);
assert.equal((fresh.merged.match(/match \/profiles\/\{profileUid\}/g)||[]).length,1);
const already=mergeTestTaskAndNicknameRules(baseline,task).merged;
const incremental=prepareTestPushCandidate(already,task,push);
assert.equal(incremental.existingTaskAndNickname,true);
assert.deepEqual(incremental.added,['pushSubscriptions/{subscriberUid}/devices/{deviceId}']);
assert.ok(incremental.merged.includes(already));
const marker=/\n    \/\/ BEGIN TEST PUSH SUBSCRIPTION ACL EXTENSION\n[\s\S]*?\n    \/\/ END TEST PUSH SUBSCRIPTION ACL EXTENSION\n  /;
assert.equal(incremental.merged.replace(marker,''),already);
assert.throws(()=>prepareTestPushCandidate(fresh.merged,task,push),
 /PUSH_SUBSCRIPTION_RULE_ALREADY_PRESENT_STOP/);
const partial=already.replace(/match \/profiles\/\{profileUid\}\s*\{/,'match /notProfiles/{profileUid} {');
assert.throws(()=>prepareTestPushCandidate(partial,task,push),
 /PARTIAL_TASK_NICKNAME_DEPLOYMENT_STOP/);
const duplicate=already.replace(/match \/profiles\/\{profileUid\}\s*\{/,
 'match /profiles/{profileUid} { match /profiles/{profileUid} {');
assert.throws(()=>prepareTestPushCandidate(duplicate,task,push),
 /DUPLICATE_RULES_STOP/);
assert.throws(()=>prepareTestPushCandidate(
 baseline.replace('function safeNoteUpdate()', 'function oldNoteUpdate()'),task,push),
 /REQUIRED_BASELINE_MISSING_OR_DUPLICATE/);
console.log('TEST_SAFE_INCREMENTAL_PUSH_CANDIDATE_THREE_OR_ONE_RULES_PASS');
