// Private Actions-environment, no-network verification. Never print key values.
import {webcrypto} from 'node:crypto';
const names=['TEST_VAPID_PUBLIC_KEY','TEST_VAPID_PRIVATE_KEY','TEST_PUSH_CONTACT'];
const missing=names.filter(name=>!process.env[name]);
if(missing.length){
 for(const key of missing)console.log('PUSH_SECRET_MISSING_'+key);
 console.log('PUSH_SECRET_READY_FALSE_SAFE_HOLD');
}else{
 const pub=process.env.TEST_VAPID_PUBLIC_KEY;
 const priv=process.env.TEST_VAPID_PRIVATE_KEY;
 const contact=process.env.TEST_PUSH_CONTACT;
 if(!/^[-_A-Za-z0-9]{87}$/.test(pub)||!/^[-_A-Za-z0-9]{43}$/.test(priv)||
   !/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
   throw Error('PUSH_SECRET_FORMAT_INVALID_SAFE_HOLD');
 const raw=Buffer.from(pub,'base64url');
 if(raw.length!==65||raw[0]!==4)throw Error('PUSH_PUBLIC_KEY_INVALID_SAFE_HOLD');
 const x=Buffer.from(raw.subarray(1,33)).toString('base64url');
 const y=Buffer.from(raw.subarray(33,65)).toString('base64url');
 try{
  const privateKey=await webcrypto.subtle.importKey('jwk',
   {kty:'EC',crv:'P-256',x,y,d:priv},
   {name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const publicKey=await webcrypto.subtle.importKey('raw',raw,
   {name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const data=new TextEncoder().encode('push-safe-setup-verification');
  const sig=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,data);
  if(!await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,sig,data))
   throw Error('KEY_PAIR_MISMATCH');
 }catch{throw Error('PUSH_PUBLIC_PRIVATE_KEY_PAIR_INVALID_SAFE_HOLD')}
 console.log('PUSH_VAPID_PAIR_AND_CONTACT_READBACK_PASS');
 // This key is explicitly PUBLIC; expose only it so CRM setup can be completed
 // without asking the owner to send any secret through a chat.
 console.log('PUSH_PUBLIC_VAPID_FOR_CRM='+pub);
}
if(process.env.TEST_PUSH_SEND_ENABLED==='EXPLICITLY_APPROVED')
 throw Error('PUSH_SENDER_ACTIVE_UNEXPECTEDLY_REVIEW_REQUIRED');
console.log('PUSH_SENDER_STILL_DISABLED_SAFE_HOLD');
