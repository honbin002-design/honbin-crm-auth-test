// Synthetic in-memory acceptance: no Firebase connection, no real push subscription.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyOwnerSubscriptionWrite as verify} from './firestore-push-write-probe.mjs';
const identity={uid:'ownerUid123',email:'honbin002@gmail.com',
 emailVerified:true,providerId:'google.com'};
const uuid=()=> '12345678-1234-1234-1234-123456789abc';
function fixture({denyWrite=false,denyDelete=false}={}){
 const data=new Map(),steps=[];
 const sdk={
  doc:(_db,...parts)=>({path:parts.join('/')}),
  serverTimestamp:()=>({server:true}),
  getDocFromServer:async ref=>{
   steps.push('get');const value=data.get(ref.path);
   return {metadata:{fromCache:false},exists:()=>!!value,data:()=>value};
  },
  setDoc:async(ref,value)=>{
   steps.push('set');if(denyWrite)throw Object.assign(new Error('permission-denied'),{code:'permission-denied'});
   data.set(ref.path,value);
  },
  deleteDoc:async ref=>{
   steps.push('delete');if(denyDelete)throw Object.assign(new Error('permission-denied'),{code:'permission-denied'});
   data.delete(ref.path);
  }
 };
 return {data,steps,sdk};
}
const good=fixture();
let result=await verify({db:{},sdk:good.sdk,identity,currentUid:()=>identity.uid,uuid});
assert.equal(result.ok,true);
assert.equal(result.cleaned,true);
assert.equal(result.cleanupPath,null);
assert.deepEqual(good.steps,['get','set','get','delete','get']);
assert.equal(good.data.size,0);
const denied=fixture({denyWrite:true});
result=await verify({db:{},sdk:denied.sdk,identity,currentUid:()=>identity.uid,uuid});
assert.equal(result.ok,false);
assert.equal(result.code,'PERMISSION_DENIED');
assert.equal(denied.data.size,0);
assert.deepEqual(denied.steps,['get','set','delete','get']);
const cannotDelete=fixture({denyDelete:true});
result=await verify({db:{},sdk:cannotDelete.sdk,identity,currentUid:()=>identity.uid,uuid});
assert.equal(result.ok,false);
assert.equal(result.cleaned,false);
assert.ok(result.cleanupPath.startsWith('pushSubscriptions/ownerUid123/devices/probe_'));
const stranger=fixture();
await assert.rejects(()=>verify({db:{},sdk:stranger.sdk,
 identity:{...identity,email:'stranger@example.com'},
 currentUid:()=>identity.uid,uuid}),/VERIFIED_ROOT_OWNER_REQUIRED/);
assert.equal(stranger.steps.length,0);
const html=readFileSync('workspace-v2.html','utf8');
assert.match(html,/id="pushWriteProbe" hidden/);
assert.match(html,/\$\('pushWriteProbe'\)\.hidden=true/);
assert.match(html,/\$\('pushWriteProbe'\)\.hidden=false/);
assert.match(html,/if\(isRootOwnerIdentity\(rootIdentity\)\)/);
assert.match(html,/verifyOwnerSubscriptionWrite/);
assert.doesNotMatch(readFileSync('firestore-push-write-probe.mjs','utf8'),
 /\bNotification\.requestPermission\(|\bPushManager\b|\bwebpush\b/i);
console.log('OWNER_PUSH_LIVE_WRITE_PROBE_SYNTHETIC_GATES_PASS');
