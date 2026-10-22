import assert from 'node:assert/strict';
import {attachInstalledCRMPushBridge} from './firebase-installed-crm-push-bridge.mjs';
// Deterministic, no-network identity and Firestore harness. No real tokens.
const saved=new Map(),events=new Map(),replies=[];
const uid='member_1',endpoint='https://web.push.apple.com/Qm9va2Vk',id='push_request_1';
const parent={location:{pathname:'/-hongbin-personal-crm-beta/'},
 postMessage:msg=>replies.push(msg)};
let signedIn=true,who=uid,enabled=true,writes=0;
const fake={
 parent,location:{origin:'https://honbin002-design.github.io'},
 crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'},
 addEventListener:(key,fn)=>events.set(key,fn),
 removeEventListener:key=>events.delete(key),
 fetch:async()=>({ok:true,json:async()=>({subscriptionsEnabled:enabled,
  senderEnabled:enabled,publicVapidKey:'A'.repeat(88)})})
};
const rec=new Map();
const sdk={
 doc:(_db,...parts)=>({path:parts.join('/')}),
 getDocFromServer:async ref=>({metadata:{fromCache:false},
  exists:()=>rec.has(ref.path),data:()=>rec.get(ref.path)}),
 setDoc:async(ref,data)=>{writes++;rec.set(ref.path,{...data})},
 serverTimestamp:()=>({seconds:10})
};
const errors=[],storage={getItem:key=>saved.get(key)||null,setItem:(key,val)=>saved.set(key,val)};
const dispose=attachInstalledCRMPushBridge({db:{},sdk,currentUid:()=>who,
 authenticated:()=>signedIn,storage,onStatus:value=>errors.push(value),win:fake});
const subscription={endpoint,keys:{p256dh:'A'.repeat(60),auth:'Z'.repeat(20)}};
async function emit(message,origin=fake.location.origin,source=parent){
 const handler=events.get('message');
 await handler({data:message,origin,source});
}
const payload={type:'HONBIN_HOST_PUSH_SUBSCRIPTION',
 requestId:id,subscription};
await emit(payload,'https://attacker.invalid');
assert.equal(writes,0,'reject cross-origin');
await emit(payload,fake.location.origin,{location:parent.location});
assert.equal(writes,0,'reject wrong parent window');
signedIn=false;await emit(payload);signedIn=true;
assert.equal(writes,0,'reject signed-out identity');
enabled=false;await emit(payload);enabled=true;
assert.equal(writes,0,'deny until sender and rules readiness are activated');
await emit(payload);
assert.equal(writes,1,'one device record from authorized user');
assert.equal(replies.at(-1).success,true);
const doc=[...rec.keys()][0];
assert.ok(doc.startsWith('pushSubscriptions/member_1/devices/iphone_'));
assert.equal(rec.get(doc).endpoint,endpoint);
assert.equal(saved.size,1,'stable device identifier per UID');
await emit(payload);
assert.equal(writes,2,'same device identifier updated, no duplicate devices');
assert.equal([...rec.keys()].length,1);
who='another_member';
await emit({...payload,requestId:'other_request'});
assert.equal([...rec.keys()].length,2,'separate Firebase identity has separate subscription record');
signedIn=false;await emit({...payload,requestId:'unauthorized'});
assert.equal([...rec.keys()].length,2,'no unauthorized writes');
dispose();assert.equal(events.has('message'),false);
assert.equal(replies.some(x=>x.success===false),true);
assert.equal(errors.some(x=>x.includes('推播訂閱未完成')),true);
console.log('PUSH_FIREBASE_IFRAME_AUTH_BRIDGE_SYNTHETIC_PASS');
