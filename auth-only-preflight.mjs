import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
const html=readFileSync('index.html','utf8');
const config=readFileSync('firebase-web-config.mjs','utf8');
const checks=[
 ['Standalone Traditional Chinese mobile page',()=>{assert.match(html,/<html lang="zh-Hant">/);assert.match(html,/viewport-fit=cover/)}],
 ['No CRM business data operations',()=>{assert.doesNotMatch(html,/simple-core\.js|r73-fixes\.js|localStorage|indexedDB|customerData|salesOrder/i)}],
 ['No Firestore SDK in published page',()=>assert.doesNotMatch(html,/firebase-firestore|firestore\/|getFirestore|collection\(|setDoc\(|writeBatch\(|runTransaction\(/)],
 ['Google popup auth is user-click initiated',()=>{assert.match(html,/signInWithPopup\(auth,provider\)/);assert.match(html,/login\.addEventListener\("click"/)}],
 ['Google identity verified before success',()=>{assert.match(html,/sign_in_provider!=="google.com"/);assert.match(html,/user\.emailVerified!==true/)}],
 ['Session-only auth persistence',()=>assert.match(html,/browserSessionPersistence/)],
 ['No hidden auto deploy, billing or secrets',()=>{assert.doesNotMatch(html+config,/serviceAccount|private_key|FIREBASE_TOKEN|billingAccounts|blaze/i)}],
 ['Firebase project is the expected one',()=>assert.match(config,/projectId: "honbin-crm-notes-spark"/)],
 ['Firestore real-data gate stays disabled',()=>assert.match(config,/export const firestoreReadyForRealData = false;/)],
 ['Unfilled API key fails closed',()=>assert.match(html,/FIREBASE_PUBLIC_WEB_CONFIG_INCOMPLETE/)],
 ['Status text is not inserted as HTML',()=>assert.match(html,/\$\("status"\)\.textContent=message/)]
];
for(const [name,fn] of checks){fn();console.log('PASS '+name)}
console.log('HONBIN_AUTH_ONLY_GITHUB_PAGES_PREFLIGHT_PASS '+checks.length);
