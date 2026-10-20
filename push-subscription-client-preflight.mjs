import assert from 'node:assert/strict';
import {pushSubscriptionService} from './firebase-push-subscription-service.mjs';
const calls=[],storage=new Map();
let user='uid_one';
const fakeSdk={
 doc:(_db,...path)=>path.join('/'),
 async getDoc(path){calls.push('get:'+path);return {exists:()=>storage.has(path),
  data:()=>storage.get(path)}},
 async setDoc(path,value){calls.push('set:'+path);storage.set(path,value)},
 async deleteDoc(path){calls.push('delete:'+path);storage.delete(path)},
 serverTimestamp:()=>({server:true})
};
const fakeSubscription={toJSON:()=>({endpoint:'https://web.push.apple.com/subscription',
 keys:{p256dh:'a'.repeat(60),auth:'b'.repeat(24)}})};
let subscribed=false,asked=false;
const registration={pushManager:{
 async getSubscription(){calls.push('getSubscription');return subscribed?fakeSubscription:null},
 async subscribe(){subscribed=true;calls.push('subscribe');return fakeSubscription}
}};
const notification={permission:'default',async requestPermission(){
 asked=true;calls.push('permission');return 'granted'}};
const vapid='B'.repeat(87);
const service=pushSubscriptionService({db:{},sdk:fakeSdk,currentUid:()=>user,
 registration,publicVapidKey:vapid,notification,deviceId:'device_1'});
assert.equal(calls.length,0);
assert.equal(asked,false);
await service.enableFromUserGesture();
assert.equal(asked,true);
assert.ok(calls.includes('subscribe'));
assert.ok(storage.has('pushSubscriptions/uid_one/devices/device_1'));
const created=storage.get('pushSubscriptions/uid_one/devices/device_1').createdAt;
await service.enableFromUserGesture();
assert.equal(storage.get('pushSubscriptions/uid_one/devices/device_1').createdAt,created);
await service.disable();
assert.equal(storage.size,0);
assert.ok(calls.includes('delete:pushSubscriptions/uid_one/devices/device_1'));
user='uid_two';
await service.enableFromUserGesture();
assert.ok(storage.has('pushSubscriptions/uid_two/devices/device_1'));
notification.permission='denied';
await assert.rejects(service.enableFromUserGesture(),/PUSH_PERMISSION_DENIED/);
assert.equal(storage.size,1);
console.log('TEST_PUSH_SUBSCRIPTION_EXPLICIT_OPT_IN_AND_ACCOUNT_SCOPE_PASS');
