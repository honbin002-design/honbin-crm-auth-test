// Browser-only, fail-closed comparison. The candidate never leaves this page.
import {prepareTestPushCandidate} from './firestore-push-safe-candidate.mjs';
const $=id=>document.getElementById(id);
const baselineTemplateRe=/<textarea id="template"[^>]*>([\s\S]*?)<\/textarea>/;
const ownerRe=/function\s+accountOwner\s*\(\)\s*\{\s*return\s+rawGoogleUser\(\)\s*&&\s*request\.auth\.uid\s*==\s*'([A-Za-z0-9_-]{1,150})'\s*;/g;
const file=async path=>{
 const response=await fetch('./'+path,{cache:'no-store',credentials:'omit'});
 if(!response.ok)throw Error('CANNOT_READ_STATIC_BASELINE');
 return response.text();
};
const decodeHtmlTemplate=html=>{
 const m=html.match(baselineTemplateRe);
 if(!m)throw Error('ARCHIVED_RULE_TEMPLATE_NOT_FOUND');
 return m[1].replaceAll('&amp;','&').replaceAll('&lt;','<')
  .replaceAll('&gt;','>').replaceAll('&quot;','"')
  .replaceAll('&#39;',"'");
};
export function verifyCandidateExact(candidate,template,task,push){
 if(typeof candidate!=='string'||candidate.length!==28361)
  throw Error('CANDIDATE_LENGTH_MISMATCH');
 if(typeof template!=='string'||typeof task!=='string'||typeof push!=='string')
  throw Error('BASELINE_NOT_LOADED');
 const found=[...candidate.matchAll(ownerRe)];
 if(found.length!==1)throw Error('ROOT_OWNER_IDENTITY_AMBIGUOUS');
 const uid=found[0][1];
 if(uid.length!==28)throw Error('ROOT_OWNER_IDENTITY_LENGTH_MISMATCH');
 const all=template.match(/__OWNER_UID__/g)||[];
 if(all.length!==2)throw Error('OWNER_PLACEHOLDER_COUNT_MISMATCH');
 const historical=template.replaceAll('__OWNER_UID__',uid);
 if(historical.length!==21784)throw Error('HISTORICAL_RULE_LENGTH_MISMATCH');
 const expected=prepareTestPushCandidate(historical,task,push);
 if(expected.originalBytes!==21784||expected.candidateBytes!==28361||
  expected.added.length!==3)throw Error('EXPECTED_EXTENSION_MISMATCH');
 if(expected.merged!==candidate)throw Error('CANDIDATE_CONTENT_DIFFERS');
 return {ok:true,oldLength:expected.originalBytes,
  candidateLength:expected.candidateBytes,additions:expected.added.length};
}
$('verify').addEventListener('click',async()=>{
 const status=$('result'),candidate=$('candidate').value;
 status.textContent='正在本機逐字核對，沒有上傳規則內容……';
 try{
  const [html,task,push]=await Promise.all([
   file('firestore-notebook-hard-delete-v4d-deploy.html'),
   file('firestore-tasks-v2-rules-REVIEW-ONLY.rules'),
   file('firestore-push-subscriptions-REVIEW-ONLY.rules')
  ]);
  const verdict=verifyCandidateExact(candidate,decodeHtmlTemplate(html),task,push);
  status.textContent='逐字核對 PASS。\n原始規則：'+verdict.oldLength+
   ' 字元\n候選規則：'+verdict.candidateLength+
   ' 字元\n新增規則路徑：'+verdict.additions+
   '\n候選與已核准 TEST 基準＋三組擴充規則：完全相同。'+
   '\n尚未發布。請回傳此畫面供下一步確認。';
 }catch(e){
  status.textContent='安全 HOLD：'+String(e?.message||e)+
   '\n不得發布。若已貼上到 Firebase 編輯器，保留未發布狀態並回傳這個錯誤。';
 }
});
