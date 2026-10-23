import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {confirmedLivePublicPushConfig as live} from './push-live-free-activation.mjs';
const pub='A'.repeat(87);
const staged={schemaVersion:1,subscriptionsEnabled:true,
 senderEnabled:false,environment:'SPARK_SUBSCRIPTION_STAGING',publicVapidKey:pub};
assert.equal(live(staged,pub),false,'staging never sends');
const enabled={...staged,senderEnabled:true,environment:'SPARK_LIVE_FREE'};
assert.equal(live(enabled,pub),true,'explicit live activation allowed');
for(const cfg of [
 null,{}, {...enabled,senderEnabled:false},
 {...enabled,subscriptionsEnabled:false},
 {...enabled,environment:'SPARK_SAFE_HOLD'},
 {...enabled,environment:'SPARK_SUBSCRIPTION_STAGING'},
 {...enabled,publicVapidKey:'B'.repeat(87)},
 {...enabled,publicVapidKey:''},
 {...enabled,schemaVersion:2}
]) assert.equal(live(cfg,pub),false,'fail-closed config mismatch');
assert.equal(live(enabled,'A'.repeat(86)),false,'bad public key must stop');
const worker=readFileSync('notification-free-sender-REVIEW-ONLY.mjs','utf8');
assert.match(worker,/verifiedPublicActivation\(process\.env\.TEST_VAPID_PUBLIC_KEY\)/);
assert.match(worker,/confirmedLivePublicPushConfig\(data,publicVapidKey\)/);
assert.match(worker,/TEST_PUSH_SEND_ENABLED/);
assert.match(worker,/approved\(event\.actorUid\)/);
assert.match(worker,/if\(!forceServerRead&&accountCache\.has\(uid\)\)/);
assert.match(worker,/approved\(uid,true\)/);
assert.match(worker,/approved\(event\.actorUid,true\)/);
assert.match(worker,/status:'SKIPPED'/);
assert.match(worker,/response\?\.statusCode!==201&&response\?\.statusCode!==202/);
assert.match(worker,/notificationDeliveryLedger/);
assert.match(worker,/notificationSenderCursors/);
assert.doesNotMatch(worker,/console\.log\([^\n]*subscription\.endpoint/);
console.log('LIVE_FREE_PUSH_SENDER_FAIL_CLOSED_GATES_PASS');
