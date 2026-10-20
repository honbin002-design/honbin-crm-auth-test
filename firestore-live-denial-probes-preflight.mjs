import assert from 'node:assert/strict';
import {verifyLiveReadDenials} from './firestore-live-denial-probes.mjs';
let uid='test_owner_uid';
let reads=[],writes=0;
const denied=()=>Object.assign(new Error('denied'),{code:'permission-denied'});
const sdk={
 doc:(_db,...parts)=>({kind:'doc',path:parts.join('/')}),
 collection:(_db,...parts)=>({kind:'collection',path:parts.join('/')}),
 async getDocFromServer(ref){reads.push(ref.path);throw denied()},
 async getDocsFromServer(ref){reads.push(ref.path);throw denied()},
 async setDoc(){writes++},async updateDoc(){writes++},async deleteDoc(){writes++}
};
const runner=()=>verifyLiveReadDenials({db:{},sdk,currentUid:()=>uid});
const first=await runner();
assert.equal(first.ok,true);
assert.equal(first.results.length,3);
assert.deepEqual(reads,[
 'profiles',
 'pushSubscriptions/__nonexistent_external_uid_20261021/devices/synthetic_device',
 'groups/__nonexistent_rule_check_group_20261021/tasks'
]);
assert.equal(writes,0,'Negative read probes must never write');
const accidentallyAllowed={...sdk,async getDocsFromServer(ref){
 reads.push(ref.path);return {docs:[]};
}};
const second=await verifyLiveReadDenials({db:{},sdk:accidentallyAllowed,currentUid:()=>uid});
assert.equal(second.ok,false);
assert.equal(second.results.filter(x=>x.status==='UNEXPECTED_ALLOWED').length,2);
const offline={...sdk,async getDocsFromServer(){throw Object.assign(new Error('network'),{code:'unavailable'})}};
const third=await verifyLiveReadDenials({db:{},sdk:offline,currentUid:()=>uid});
assert.equal(third.ok,false);
assert.ok(third.results.some(x=>x.status==='HOLD'));
let changed=false;
const swapped={...sdk,async getDocsFromServer(ref){
 reads.push(ref.path);if(!changed){uid='new_account';changed=true}
 throw denied();
}};
await assert.rejects(()=>verifyLiveReadDenials({db:{},sdk:swapped,currentUid:()=>uid}),
 /ACCOUNT_CHANGED/);
assert.equal(writes,0);
console.log('FIRESTORE_LIVE_DENIED_READS_3_PATHS_FAIL_CLOSED_NO_WRITES_PASS');
