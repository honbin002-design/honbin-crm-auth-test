import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeTestTaskAndNicknameRules} from './firestore-task-nickname-offline-merge.mjs';
import {mergeTestPushRules} from './firestore-push-offline-merge.mjs';
const fixture=readFileSync('firestore-notebook-hard-delete-v4d-deploy.html','utf8');
const match=fixture.match(/<textarea id="template"[^>]*>([\s\S]*?)<\/textarea>/);
assert.ok(match);
const old=match[1].replaceAll('&amp;','&').replaceAll('&lt;','<')
 .replaceAll('&gt;','>').replaceAll('__OWNER_UID__','synthetic_owner');
const base=mergeTestTaskAndNicknameRules(old,
 readFileSync('firestore-tasks-v2-rules-REVIEW-ONLY.rules','utf8')).merged;
const push=mergeTestPushRules(base,
 readFileSync('firestore-push-subscriptions-REVIEW-ONLY.rules','utf8'));
assert.equal(push.exactOriginalPreserved,true);
assert.equal((push.merged.match(/match \/pushSubscriptions\/\{subscriberUid\}\/devices\/\{deviceId\}/g)||[]).length,1);
assert.equal((push.merged.match(/function safeNoteUpdate\(/g)||[]).length,1);
assert.throws(()=>mergeTestPushRules(push.merged,
 readFileSync('firestore-push-subscriptions-REVIEW-ONLY.rules','utf8')),
 /SUBSCRIPTION_RULE_ALREADY_EXISTS/);
const worker=readFileSync('notification-free-sender-REVIEW-ONLY.mjs','utf8');
const workflow=readFileSync('.github/workflows/push-sender-review.yml','utf8');
const runtime=JSON.parse(readFileSync('package.json','utf8'));
assert.equal(runtime.dependencies['firebase-admin'],'14.5.0');
assert.equal(runtime.dependencies['web-push'],'3.6.7');
assert.match(worker,/TEST_PUSH_SEND_ENABLED/);
assert.match(worker,/EXPLICITLY_APPROVED/);
assert.match(worker,/honbin-crm-notes-spark/);
assert.match(worker,/web\.push\.apple\.com/);
assert.match(worker,/notificationDeliveryLedger/);
assert.match(worker,/notificationSenderCursors/);
assert.match(worker,/collectionGroup\(stream\.collection\)/);
assert.match(worker,/\.limit\(40\)/);
assert.match(worker,/PUSH_RUN_DELIVERY_BUDGET_STOP/);
assert.match(worker,/PUSH_DEVICE_LIMIT_STOP/);
assert.match(worker,/PUSH_GROUP_MEMBER_LIMIT_STOP/);
assert.doesNotMatch(worker,/db\.collection\('groups'\)\.get\(\)/);
assert.doesNotMatch(worker,/groupDoc\.ref\.collection\('tasks'\)\.get\(\)/);
assert.match(workflow,/workflow_dispatch:/);
assert.doesNotMatch(workflow,/^\s+schedule:/m);
assert.doesNotMatch(workflow,/secrets\./);
console.log('TEST_FREE_PUSH_SENDER_HOLD_AND_PRIVATE_SUBSCRIPTION_RULES_PASS');
