// Review-only TEST rule extension. Appends exactly one private subscription
// match to an already merged V4D + task/nickname rules candidate.
const target='match /pushSubscriptions/{subscriberUid}/devices/{deviceId}';
export function mergeTestPushRules(current,fragment){
 if(typeof current!=='string'||typeof fragment!=='string'
   ||current.length<1000||fragment.length<500)throw Error('INVALID_RULE_INPUT');
 if(!current.includes('BEGIN TEST TASK ACL EXTENSION')
  ||!current.includes('BEGIN TEST NICKNAME ACL EXTENSION')
  ||!current.includes('function googleUser()')
  ||!current.includes('function safeNoteUpdate('))
  throw Error('REQUIRED_BASELINE_MISSING');
 if(current.includes(target))throw Error('SUBSCRIPTION_RULE_ALREADY_EXISTS');
 const m=fragment.match(/match\s+\/pushSubscriptions\/\{subscriberUid\}\/devices\/\{deviceId\}\s*\{/g);
 if(!m||m.length!==1)throw Error('SUBSCRIPTION_MATCH_MUST_APPEAR_ONCE');
 const start=fragment.indexOf(m[0]),open=start+m[0].lastIndexOf('{');
 let depth=0,end=-1,state='CODE',quote='',escape=false;
 for(let i=open;i<fragment.length;i++){
  const c=fragment[i],next=fragment[i+1];
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
  if(c==='}'&&--depth===0){end=i;break}
 }
 if(end<0)throw Error('SUBSCRIPTION_BRACES_INVALID');
 const block=fragment.slice(start,end+1);
 const rootMatch=current.match(/match\\s+\\/databases\\/\\{database\\}\\/documents\\s*\\{/);
 if(!rootMatch)throw Error('DATABASE_ROOT_MISSING');
 const rootOpen=current.indexOf(rootMatch[0])+rootMatch[0].lastIndexOf('{');
 let rootDepth=0,rootClose=-1,rootState='CODE',rootQuote='',rootEscape=false;
 for(let i=rootOpen;i<current.length;i++){
  const c=current[i],next=current[i+1];
  if(rootState==='LINE'){if(c==='\\n')rootState='CODE';continue}
  if(rootState==='BLOCK'){if(c==='*'&&next==='/'){rootState='CODE';i++}continue}
  if(rootState==='STRING'){
   if(rootEscape){rootEscape=false;continue}
   if(c==='\\\\'){rootEscape=true;continue}
   if(c===rootQuote)rootState='CODE';
   continue;
  }
  if(c==='/'&&next==='/'){rootState='LINE';i++;continue}
  if(c==='/'&&next==='*'){rootState='BLOCK';i++;continue}
  if(c==='"'||c==="'"){rootState='STRING';rootQuote=c;continue}
  if(c==='{')rootDepth++;
  if(c==='}'&&--rootDepth===0){rootClose=i;break}
 }
 if(rootClose<0)throw Error('DATABASE_ROOT_UNBALANCED');
 const inserted='\n    // BEGIN TEST PUSH SUBSCRIPTION ACL EXTENSION\n'+
  block.split('\n').map(line=>line?'    '+line:line).join('\n')+
  '\n    // END TEST PUSH SUBSCRIPTION ACL EXTENSION\n  ';
 const merged=current.slice(0,rootClose)+inserted+current.slice(rootClose);
 if(merged.replace(inserted,'')!==current)throw Error('ORIGINAL_RULES_CHANGED');
 return Object.freeze({merged,exactOriginalPreserved:true,
  added:'pushSubscriptions/{subscriberUid}/devices/{deviceId}'});
}
