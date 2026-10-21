// Synthetic emulator only; never fetch or modify live Firebase Rules.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {mergeTestTaskAndNicknameRules} from './firestore-task-nickname-offline-merge.mjs';
import {upgradeTaskAclV3} from './firestore-task-v3-exact-upgrade.mjs';
import {upgradeTaskAclV4} from './firestore-task-v4-exact-upgrade.mjs';
import {mergeTestPushRules} from './firestore-push-offline-merge.mjs';
const html=readFileSync('firestore-notebook-hard-delete-v4d-deploy.html','utf8');
const m=html.match(/<textarea id="template"[^>]*>([\s\S]*?)<\/textarea>/);
if(!m)throw Error('MISSING_SYNTHETIC_BASE');
const base=m[1].replaceAll('&amp;','&').replaceAll('&lt;','<')
 .replaceAll('&gt;','>').replaceAll('__OWNER_UID__','uid_owner');
const v2=readFileSync('firestore-tasks-v2-rules-REVIEW-ONLY.rules','utf8');
const v3=readFileSync('firestore-tasks-v3-all-members-extension-REVIEW-ONLY.rules','utf8');
const old=mergeTestTaskAndNicknameRules(base,v2).merged;
const upgraded=upgradeTaskAclV3(old,v2,v3).merged;
const v4=readFileSync('firestore-tasks-v4-publisher-deadline-REVIEW-ONLY.rules','utf8');
const finalRules=upgradeTaskAclV4(upgraded,v3,v4).merged;
const push=readFileSync('firestore-push-subscriptions-REVIEW-ONLY.rules','utf8');
const merged=mergeTestPushRules(finalRules,push).merged;
mkdirSync('.test-rules',{recursive:true});
writeFileSync('.test-rules/firestore.emulator.rules',merged);
console.log('SYNTHETIC_TASK_V4_EMULATOR_RULES_READY');
