// TEST-only offline review. No Firebase SDK, credentials, or network calls.
// A merge never publishes Rules; users must review the exact two additions.
const unique=(text,re,label)=>{
 const found=[...String(text).matchAll(re)];
 if(found.length!==1)throw Error(label+'_MUST_APPEAR_EXACTLY_ONCE');
 return found[0];
};
// Returns matching closing brace while skipping comments and Firestore quoted regex strings.
function closingBrace(source,open){
 if(source[open]!=='{')throw Error('EXPECTED_OPEN_BRACE');
 let depth=0,state='CODE',quote='',escape=false;
 for(let i=open;i<source.length;i++){
  const c=source[i],next=source[i+1];
  if(state==='LINE'){if(c==='\n')state='CODE';continue}
  if(state==='BLOCK'){if(c==='*'&&next==='/'){state='CODE';i++}continue}
  if(state==='STRING'){
   if(escape){escape=false;continue}
   if(c==='\\'){escape=true;continue}
   if(c===quote)state='CODE';
   continue;
  }
  if(c==='/'&&next==='/'){state='LINE';i++;continue}
  if(c==='/'&&next==='*'){state='BLOCK';i++;continue}
  if(c==='"'||c==="'"){state='STRING';quote=c;continue}
  if(c==='{')depth++;
  if(c==='}'&&--depth===0)return i;
  if(depth<0)throw Error('UNEXPECTED_CLOSING_BRACE');
 }
 throw Error('UNBALANCED_FIRESTORE_RULES');
}
const locate=(source,re,label)=>{
 const m=unique(source,re,label);
 const open=m.index+m[0].lastIndexOf('{');
 return {open,close:closingBrace(source,open)};
};
const selectBlock=(source,re,label)=>{
 const span=locate(source,re,label);
 return source.slice(span.open,span.close+1);
};
function extractMatch(source,re,label){
 const m=unique(source,re,label);
 const open=m.index+m[0].lastIndexOf('{'),close=closingBrace(source,open);
 return source.slice(m.index,close+1);
}
export function mergeTestTaskAndNicknameRules(current,fragment){
 if(typeof current!=='string'||typeof fragment!=='string')throw Error('RULES_TEXT_REQUIRED');
 if(current.length<500||current.length>250000)throw Error('CURRENT_RULES_LENGTH_INVALID');
 if(fragment.length<500||fragment.length>20000)throw Error('FRAGMENT_LENGTH_INVALID');
 if(!/rules_version\s*=\s*'2'\s*;/.test(current)||
    !/service\s+cloud\.firestore/.test(current))
   throw Error('NOT_FIRESTORE_RULES_V2');
 if(current.includes('__OWNER_UID__'))throw Error('UNRESOLVED_OWNER_PLACEHOLDER');
 for(const [name,re] of [
  ['ACCOUNT_APPROVAL',/match\s+\/approvedAccounts\/\{[^}]+\}\s*\{/],
  ['GOOGLE_ALLOWLIST',/function\s+googleUser\s*\(/],
  ['NOTE_SAFETY',/function\s+safeNoteUpdate\s*\(/],
  ['GROUP_READ',/function\s+canViewGroup\s*\(/],
  ['GROUP_EDIT',/function\s+canEditGroup\s*\(/],
  ['GROUP_ADMIN',/function\s+canAdminGroup\s*\(/],
  ['GROUP_MEMBERS',/match\s+\/members\/\{memberUid\}\s*\{/],
  ['GROUP_NOTES',/match\s+\/notes\/\{noteId\}\s*\{/],
  ['GROUP_INVITES',/match\s+\/sentInvites\/\{invitationId\}\s*\{/]
 ])if(!re.test(current))throw Error('REQUIRED_EXISTING_RULE_MISSING_'+name);
 if(/match\s+\/profiles\/\{/.test(current)||
   /match\s+\/tasks\/\{/.test(current))
  throw Error('TARGET_RULE_ALREADY_EXISTS_STOP');
 const rootRE=/match\s+\/databases\/\{database\}\/documents\s*\{/g;
 const groupRE=/match\s+\/groups\/\{groupId\}\s*\{/g;
 const group=locate(current,groupRE,'GROUP');
 const notes=locate(current,/match\s+\/notes\/\{noteId\}\s*\{/g,'NOTES');
 if(notes.open<=group.open||notes.close>=group.close)
   throw Error('NOTES_NOT_NESTED_IN_TARGET_GROUP');
 const originalRoot=locate(current,rootRE,'DATABASE_ROOT');
 if(group.open<=originalRoot.open||group.close>=originalRoot.close)
   throw Error('GROUP_NOT_NESTED_IN_ROOT');
 const nickname=extractMatch(fragment,/match\s+\/profiles\/\{profileUid\}\s*\{/g,'PROFILE_FRAGMENT');
 const tasks=extractMatch(fragment,/match\s+\/tasks\/\{taskId\}\s*\{/g,'TASK_FRAGMENT');
 const indent=(text,n)=>text.split('\n').map(line=>line?' '.repeat(n)+line:'').join('\n');
 const insertedTasks='\n      // BEGIN TEST TASK ACL EXTENSION (REVIEWED SEPARATELY)\n'+
  indent(tasks,6)+'\n      // END TEST TASK ACL EXTENSION\n    ';
 const withTasks=current.slice(0,group.close)+insertedTasks+current.slice(group.close);
 const root=locate(withTasks,rootRE,'DATABASE_ROOT');
 const insertedProfile='\n    // BEGIN TEST NICKNAME ACL EXTENSION (REVIEWED SEPARATELY)\n'+
  indent(nickname,4)+'\n    // END TEST NICKNAME ACL EXTENSION\n  ';
 const merged=withTasks.slice(0,root.close)+insertedProfile+withTasks.slice(root.close);
 if(merged.replace(insertedProfile,'').replace(insertedTasks,'')!==current)
  throw Error('ORIGINAL_RULES_WERE_MODIFIED');
 return Object.freeze({merged,added:['groups/{groupId}/tasks/{taskId}','profiles/{profileUid}'],
   originalBytes:current.length,mergedBytes:merged.length,
   exactOriginalPreserved:true});
}
