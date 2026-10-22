// Firebase Rules API readback: no writes, no raw Rules/credentials in output.
// A 403 is a SAFE_HOLD finding, not permission to guess or deploy Rules.
const PROJECT='honbin-crm-notes-spark';
const name='honbin-test-push-sender@'+PROJECT+'.iam.gserviceaccount.com';
const raw=process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON;
if(!raw)throw Error('RULES_READBACK_CREDENTIAL_MISSING_STOP');
let config;
try{config=JSON.parse(raw)}catch{throw Error('RULES_READBACK_CREDENTIAL_INVALID_STOP')}
if(config.project_id!==PROJECT||config.client_email!==name||
   config.type!=='service_account')throw Error('WRONG_SERVICE_ACCOUNT_STOP');
const {cert}=await import('firebase-admin/app');
const token=(await cert(config).getAccessToken()).access_token;
const endpoint='https://firebaserules.googleapis.com/v1/';
async function get(relative){
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const resp=await fetch(endpoint+relative,{method:'GET',
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   signal:ctrl.signal});
  if(!resp.ok){
   const status=resp.status;
   // Never print cloud IAM resources, response bodies or API tokens.
   console.log('FIRESTORE_RULES_API_READ_'+
     (status===403?'DENIED_403_SAFE_HOLD':status===404?'MISSING_404_SAFE_HOLD':'HTTP_'+status+'_SAFE_HOLD'));
   process.exitCode=2;return null;
  }
  return resp.json();
 }catch{
  console.log('FIRESTORE_RULES_API_UNAVAILABLE_SAFE_HOLD');
  process.exitCode=2;return null;
 }finally{clearTimeout(timer)}
}
const release=await get('projects/'+PROJECT+'/releases/cloud.firestore');
if(release){
 const rulesetName=release.rulesetName;
 if(typeof rulesetName!=='string'||
    !/^projects\/honbin-crm-notes-spark\/rulesets\/[A-Za-z0-9_-]+$/.test(rulesetName))
  throw Error('INVALID_DEPLOYED_RULESET_NAME_STOP');
 console.log('FIRESTORE_ACTIVE_RELEASE_READ_PASS');
 const rule=await get(rulesetName);
 if(rule){
  const sources=rule.source?.files||[];
  const text=sources.map(x=>x.content||'').join('\n');
  if(!text||text.length>200000)throw Error('RULESET_CONTENT_INVALID_STOP');
  const numMatches=(text.match(/match\s+\/pushSubscriptions\/\{subscriberUid\}\/devices\/\{deviceId\}\s*\{/g)||[]).length;
  if(numMatches!==1){
   console.log('PUSH_SUBSCRIPTION_ACL_'+(numMatches?'DUPLICATE':'MISSING')+'_SAFE_HOLD');
   process.exitCode=2;
  }else{
   // Scope existence alone does not prove a denial; require real client denial
   // probes, including querying other UIDs, before ever enabling subscriptions.
   const idx=text.indexOf('match /pushSubscriptions/{subscriberUid}/devices/{deviceId}');
   const snippet=text.slice(idx,idx+2300);
   const basics=snippet.includes('request.auth.uid == subscriberUid') &&
     snippet.includes('allow get, list:')&&
     snippet.includes('allow create:')&&snippet.includes('allow update:') &&
     snippet.includes('allow delete:');
   if(basics)console.log('PUSH_ACL_EXPECTED_SHAPE_PRESENT_UNVERIFIED_DENIAL');
   else{console.log('PUSH_ACL_SHAPE_INCOMPLETE_SAFE_HOLD');process.exitCode=2}
  }
  console.log('FIRESTORE_RULES_SOURCE_PRIVATE_NOT_PRINTED');
 }
}
