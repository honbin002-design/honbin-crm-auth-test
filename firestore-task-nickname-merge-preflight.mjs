import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeTestTaskAndNicknameRules} from './firestore-task-nickname-offline-merge.mjs';
const fragment=readFileSync('firestore-tasks-v2-rules-REVIEW-ONLY.rules','utf8');
const source=readFileSync('firestore-notebook-hard-delete-v4d-deploy.html','utf8');
const match=source.match(/<textarea id="template"[^>]*>([\s\S]*?)<\/textarea>/);
assert.ok(match,'Archived V4D fixture required for offline testing');
const original=match[1]
 .replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')
 .replaceAll('&quot;','"').replaceAll('&#39;',"'")
 .replaceAll('__OWNER_UID__','synthetic_mock_owner');
assert.match(original,/match \/approvedAccounts\/\{/);
assert.match(original,/match \/notes\/\{noteId\}/);
const result=mergeTestTaskAndNicknameRules(original,fragment);
assert.equal(result.exactOriginalPreserved,true);
assert.deepEqual(result.added,['groups/{groupId}/tasks/{taskId}','profiles/{profileUid}']);
assert.match(result.merged,/request\.resource\.data\.completedAt == request\.time/);
assert.match(result.merged,/request\.resource\.data\.updatedAt == request\.time/);
assert.equal((result.merged.match(/match \/tasks\/\{taskId\}\s*\{/g)||[]).length,1);
assert.equal((result.merged.match(/match \/profiles\/\{profileUid\}\s*\{/g)||[]).length,1);
assert.equal((result.merged.match(/function safeNoteUpdate\(/g)||[]).length,1);
assert.equal((result.merged.match(/match \/approvedAccounts\/\{/g)||[]).length,1);
// Incrementally applied patches must never overwrite or duplicate existing ACL.
assert.throws(()=>mergeTestTaskAndNicknameRules(result.merged,fragment),
 /TARGET_RULE_ALREADY_EXISTS_STOP/);
assert.throws(()=>mergeTestTaskAndNicknameRules(source,fragment),
 /UNRESOLVED_OWNER_PLACEHOLDER|REQUIRED_EXISTING_RULE_MISSING/);
assert.throws(()=>mergeTestTaskAndNicknameRules(original.replace(
 'function safeNoteUpdate()', 'function oldNoteUpdate()'),fragment),
 /REQUIRED_EXISTING_RULE_MISSING_NOTE_SAFETY/);
assert.throws(()=>mergeTestTaskAndNicknameRules(original,
 fragment.replace('match /tasks/{taskId}', 'match /notTasks/{taskId}')),
 /TASK_FRAGMENT_MUST_APPEAR_EXACTLY_ONCE/);
const helper=readFileSync('firestore-task-nickname-merge-review.html','utf8');
assert.match(helper,/不會發布、不會讀寫 Firestore/);
assert.match(helper,/prepareTestPushCandidate/);
assert.doesNotMatch(helper,/firebasejs|signInWithPopup|fetch\(['"]https?:/);
console.log('EXACT_TWO_RULE_MATCHES_OFFLINE_MERGE_PASS');
