import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareTestPushCandidate} from './firestore-push-safe-candidate.mjs';
const html=readFileSync('firestore-notebook-hard-delete-v4d-deploy.html','utf8');
const src=readFileSync('firebase-rules-final-verify.js','utf8');
const page=readFileSync('firebase-rules-final-verify.html','utf8');
const placeholder=html.match(/<textarea id="template"[^>]*>([\s\S]*?)<\/textarea>/)?.[1];
assert.ok(placeholder);
const archive=placeholder.replaceAll('&amp;','&').replaceAll('&lt;','<')
 .replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'");
const uid='A'.repeat(28),historical=archive.replaceAll('__OWNER_UID__',uid);
assert.equal(historical.length,21784,'exact earlier screenshot original length');
const task=readFileSync('firestore-tasks-v2-rules-REVIEW-ONLY.rules','utf8');
const push=readFileSync('firestore-push-subscriptions-REVIEW-ONLY.rules','utf8');
const expected=prepareTestPushCandidate(historical,task,push);
assert.equal(expected.candidateBytes,28361,'exact earlier screenshot candidate length');
const oldDoc=globalThis.document;
globalThis.document={getElementById:()=>({addEventListener(){}})};
const {verifyCandidateExact}=await import('./firebase-rules-final-verify.js');
globalThis.document=oldDoc;
const result=verifyCandidateExact(expected.merged,archive,task,push);
assert.deepEqual(result,{ok:true,oldLength:21784,candidateLength:28361,additions:3});
const alter=(from,to)=>{
 assert.ok(expected.merged.includes(from));
 const corrupted=expected.merged.replace(from,to);
 assert.equal(corrupted.length,expected.merged.length);
 assert.throws(()=>verifyCandidateExact(corrupted,archive,task,push),
  /CANDIDATE_CONTENT_DIFFERS/);
};
alter('allow delete: if false;','allow delete: if true ;');
alter('request.resource.data.completedAt == request.time',
 'request.resource.data.completedAt == request.times');
assert.throws(()=>verifyCandidateExact(expected.merged+' ',archive,task,push),
 /CANDIDATE_LENGTH_MISMATCH/);
assert.throws(()=>verifyCandidateExact(expected.merged.replace(uid,'B'.repeat(28)),archive,task,push),
 /CANDIDATE_CONTENT_DIFFERS/);
assert.match(page,/id="candidate"/);
assert.match(page,/firebase-rules-final-verify\.js/);
assert.match(page,/不會修改 Firebase/);
assert.match(src,/candidateLength/);
assert.doesNotMatch(src,/fetch\([^)]*candidate/);
assert.doesNotMatch(src,/localStorage|indexedDB|sessionStorage|navigator\.sendBeacon/);
assert.doesNotMatch(src,/setDoc|updateDoc|firebasejs|firebase-admin/);
console.log('TEST_EXACT_CANDIDATE_BASELINE_21784_TO_28361_AND_MUTATION_DENIAL_PASS');
