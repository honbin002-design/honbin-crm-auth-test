// TEST-only offline candidate selector. Does not access Firebase or publish.
// Handles both fresh V4D Rules and already deployed task/nickname extensions.
// A partial/mismatched state fails closed rather than duplicating permissions.
import {mergeTestTaskAndNicknameRules} from './firestore-task-nickname-offline-merge.mjs';
import {mergeTestPushRules} from './firestore-push-offline-merge.mjs';
const count=(s,re)=>[...s.matchAll(re)].length;
export function prepareTestPushCandidate(current,taskFragment,pushFragment){
 if(typeof current!=='string'||current.length<500||current.length>250000)
  throw Error('CURRENT_RULES_REQUIRED');
 if(!/rules_version\s*=\s*'2'\s*;/.test(current)||
   !/service\s+cloud\.firestore/.test(current)||
   current.includes('__OWNER_UID__'))throw Error('INVALID_CURRENT_RULES');
 for(const re of [
  /function\s+googleUser\s*\(/g,
  /function\s+safeNoteUpdate\s*\(/g,
  /match\s+\/groups\/\{groupId\}\s*\{/g,
  /match\s+\/notes\/\{noteId\}\s*\{/g,
  /match\s+\/approvedAccounts\/\{[^}]+\}\s*\{/g
 ])if(count(current,re)!==1)throw Error('REQUIRED_BASELINE_MISSING_OR_DUPLICATE');
 const hasTask=count(current,/match\s+\/tasks\/\{taskId\}\s*\{/g);
 const hasProfile=count(current,/match\s+\/profiles\/\{profileUid\}\s*\{/g);
 const hasPush=count(current,/match\s+\/pushSubscriptions\/\{subscriberUid\}\/devices\/\{deviceId\}\s*\{/g);
 if(hasTask>1||hasProfile>1||hasPush>1)throw Error('DUPLICATE_RULES_STOP');
 if(hasTask!==hasProfile)throw Error('PARTIAL_TASK_NICKNAME_DEPLOYMENT_STOP');
 if(hasPush)throw Error('PUSH_SUBSCRIPTION_RULE_ALREADY_PRESENT_STOP');
 let base=current,added=[];
 if(!hasTask){
  const merged=mergeTestTaskAndNicknameRules(current,taskFragment);
  base=merged.merged;added=merged.added;
 }else{
  // Already deployed Rules may differ from the current review fragment.
  // Preserve them exactly; do not silently replace or widen privileges.
  for(const re of [
   /match\s+\/tasks\/\{taskId\}\s*\{/,
   /match\s+\/profiles\/\{profileUid\}\s*\{/,
   /function\s+canEditGroup\s*\(/,
   /function\s+canAdminGroup\s*\(/
  ])if(!re.test(current))throw Error('EXISTING_EXTENSION_BASELINE_INVALID');
 }
 const result=mergeTestPushRules(base,pushFragment);
 const allAdded=[...added,result.added];
 const marker='\n    // BEGIN TEST PUSH SUBSCRIPTION ACL EXTENSION\n';
 if(!result.merged.includes(marker))throw Error('PUSH_EXTENSION_MARKER_MISSING');
 // Exact-preservation check: both stages insert text only.
 const originalBytes=current.length,candidateBytes=result.merged.length;
 if(candidateBytes<=originalBytes)throw Error('CANDIDATE_NOT_ADDITIVE');
 return Object.freeze({merged:result.merged,added:Object.freeze(allAdded),
  originalBytes,candidateBytes,existingTaskAndNickname:!!hasTask,
  exactOriginalPreserved:true});
}
