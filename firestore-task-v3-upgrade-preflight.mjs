import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeTestTaskAndNicknameRules} from './firestore-task-nickname-offline-merge.mjs';
import {upgradeTaskAclV3} from './firestore-task-v3-exact-upgrade.mjs';
const html=readFileSync('firestore-notebook-hard-delete-v4d-deploy.html','utf8');
const m=html.match(/<textarea id="template"[^>]*>([\s\S]*?)<\/textarea>/);
assert.ok(m,'fixture required');
const base=m[1].replaceAll('&amp;','&').replaceAll('&lt;','<')
 .replaceAll('&gt;','>').replaceAll('__OWNER_UID__','synthetic_owner');
const v2=readFileSync('firestore-tasks-v2-rules-REVIEW-ONLY.rules','utf8');
const v3=readFileSync('firestore-tasks-v3-all-members-extension-REVIEW-ONLY.rules','utf8');
const current=mergeTestTaskAndNicknameRules(base,v2).merged;
const result=upgradeTaskAclV3(current,v2,v3);
assert.equal(result.exactOtherRulesPreserved,true);
assert.equal(result.notDeployed,true);
assert.match(result.merged,/allow create: if canViewGroup\(groupId\)/);
assert.match(result.merged,/extensionPending/);
assert.match(result.merged,/extensionRequests/);
assert.match(result.merged,/resource\.data\.createdBy == request\.auth\.uid/);
assert.match(result.merged,/request\.resource\.data\.dueDate == resource\.data\.dueDate/);
assert.equal((result.merged.match(/match \/tasks\/\{taskId\}/g)||[]).length,1);
assert.equal((result.merged.match(/match \/notes\/\{noteId\}/g)||[]).length,1);
assert.equal((result.merged.match(/match \/profiles\/\{profileUid\}/g)||[]).length,1);
assert.throws(()=>upgradeTaskAclV3(result.merged,v2,v3),/CURRENT_TASK_ACL_DIFFERS/);
const taskStart=current.indexOf('match /tasks/{taskId} {');
assert.ok(taskStart>0);
const tampered=current.slice(0,taskStart)+current.slice(taskStart).replace(
 'allow create: if canEditGroup(groupId)','allow create: if true');
assert.throws(()=>upgradeTaskAclV3(tampered,v2,v3),
 /CURRENT_TASK_ACL_DIFFERS/);
assert.throws(()=>upgradeTaskAclV3(base,v2,v3),/REQUIRED_EXISTING_ACL_MISSING/);
console.log('TASK_V3_EXACT_REPLACEMENT_OFFLINE_PASS (NOT FIREBASE COMPILATION OR LIVE ACL TEST)');
