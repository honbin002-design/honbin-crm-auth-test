// Offline TEST-only exact task ACL upgrade. No Firebase SDK, network or writes.
// Fail closed if the deployed task block differs from the reviewed V2 baseline.
function findBlock(source,marker){
 const indexes=[...source.matchAll(new RegExp(marker,'g'))];
 if(indexes.length!==1)throw Error('TASK_MATCH_MUST_APPEAR_EXACTLY_ONCE');
 const start=indexes[0].index,open=source.indexOf('{',start);
 if(open<0)throw Error('MISSING_OPEN_BRACE');
 let depth=0,mode='code',quote='',escape=false;
 for(let i=open;i<source.length;i++){
  const c=source[i],n=source[i+1];
  if(mode==='line'){if(c==='\n')mode='code';continue}
  if(mode==='block'){if(c==='*'&&n==='/'){mode='code';i++}continue}
  if(mode==='quote'){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote)mode='code';continue}
  if(c==='/'&&n==='/'){mode='line';i++;continue}
  if(c==='/'&&n==='*'){mode='block';i++;continue}
  if(c==='"'||c==="'"){mode='quote';quote=c;continue}
  if(c==='{')depth++;
  if(c==='}'&&--depth===0)return {start,end:i+1,block:source.slice(start,i+1)};
 }
 throw Error('UNBALANCED_TASK_RULES');
}
const marker='match\\s+\\/tasks\\/\\{taskId\\}\\s*\\{';
function normalize(source){
 return source.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,'');
}
export function upgradeTaskAclV3(current,v2,v3){
 if(typeof current!=='string'||current.length<500||current.length>250000)throw Error('CURRENT_RULES_INVALID');
 if(!/rules_version\s*=\s*'2'\s*;/.test(current)||!/service\s+cloud\.firestore/.test(current))
  throw Error('NOT_FIRESTORE_V2');
 for(const re of [/match\s+\/approvedAccounts\//,/function\s+canViewGroup\s*\(/,
  /function\s+canEditGroup\s*\(/,/match\s+\/notes\/\{noteId\}/,
  /match\s+\/members\/\{memberUid\}/,/match\s+\/profiles\/\{profileUid\}/]){
  if(!re.test(current))throw Error('REQUIRED_EXISTING_ACL_MISSING');
 }
 const original=findBlock(current,marker);
 const expected=findBlock(v2,marker);
 const next=findBlock(v3,marker);
 if(normalize(original.block)!==normalize(expected.block))
  throw Error('CURRENT_TASK_ACL_DIFFERS_FROM_REVIEWED_V2_STOP');
 if(!next.block.includes('extensionHistory')||!next.block.includes('allow create: if canViewGroup(groupId)'))
  throw Error('V3_CANDIDATE_INVALID');
 const merged=current.slice(0,original.start)+next.block+current.slice(original.end);
 if(merged.replace(next.block,original.block)!==current)throw Error('ORIGINAL_RULES_NOT_PRESERVED');
 return Object.freeze({merged,exactOtherRulesPreserved:true,
  originalBytes:current.length,candidateBytes:merged.length,
  replaced:['groups/{groupId}/tasks/{taskId}'],notDeployed:true});
}
