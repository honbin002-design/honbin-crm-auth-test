// Root-account initiated LIVE Firestore ACL probe, using only a deliberately
// synthetic, non-deliverable Apple endpoint. No push permissions or Firebase Admin.
// It always attempts cleanup, and success requires server-confirmed deletion.
const ID=/^[A-Za-z0-9_-]{1,120}$/;
const OWNER_EMAIL='honbin002@gmail.com';
const permitted=identity=>identity?.email?.toLowerCase()===OWNER_EMAIL &&
 identity.emailVerified===true && identity.providerId==='google.com' &&
 typeof identity.uid==='string' && ID.test(identity.uid);
const safeCode=error=>{
 const raw=String(error?.code||error?.message||'UNKNOWN');
 return /permission-denied/.test(raw)?'PERMISSION_DENIED':
  /unavailable|network|deadline-exceeded/.test(raw)?'NETWORK_UNAVAILABLE':'SERVER_CHECK_HOLD';
};
export async function verifyOwnerSubscriptionWrite({
 db,sdk,identity,currentUid,uuid
}){
 if(!db||!sdk||!permitted(identity)||typeof currentUid!=='function'||
  typeof uuid!=='function')throw Error('VERIFIED_ROOT_OWNER_REQUIRED');
 for(const name of ['doc','getDocFromServer','setDoc','deleteDoc','serverTimestamp'])
  if(typeof sdk[name]!=='function')throw Error('SDK_REQUIRED_'+name);
 const who=identity.uid;
 const stillOwner=()=>{if(currentUid()!==who)throw Error('ACCOUNT_CHANGED')};
 const nonce=String(uuid()).replaceAll('-','');
 if(!/^[A-Za-z0-9]{32}$/.test(nonce))throw Error('SECURE_UUID_REQUIRED');
 const deviceId='probe_'+nonce;
 const path=['pushSubscriptions',who,'devices',deviceId];
 const ref=sdk.doc(db,...path);
 const endpoint='https://web.push.apple.com/acl_probe_'+nonce;
 const record={
  endpoint,p256dh:'A'.repeat(65),auth:'B'.repeat(24),
  createdAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()
 };
 let attempted=false,readback=false,cleaned=false,failCode=null;
 try{
  stillOwner();
  const before=await sdk.getDocFromServer(ref);
  stillOwner();
  if(before.metadata?.fromCache||before.exists())throw Error('PROBE_COLLISION_OR_CACHE');
  attempted=true;
  await sdk.setDoc(ref,record);
  stillOwner();
  const after=await sdk.getDocFromServer(ref);
  stillOwner();
  if(after.metadata?.fromCache||!after.exists() ||
   after.data()?.endpoint!==endpoint||
   after.data()?.p256dh!==record.p256dh||
   after.data()?.auth!==record.auth)
   throw Error('SERVER_WRITE_READBACK_UNCONFIRMED');
  readback=true;
 }catch(error){failCode=safeCode(error)}
 finally{
  if(attempted){
   // Cleanup is required even if the write's network acknowledgement was lost.
   try{
    stillOwner();
    await sdk.deleteDoc(ref);
    stillOwner();
    const final=await sdk.getDocFromServer(ref);
    stillOwner();
    cleaned=!final.metadata?.fromCache&&!final.exists();
   }catch(error){
    cleaned=false;
    failCode=failCode||'CLEANUP_NOT_CONFIRMED';
   }
  }
 }
 return Object.freeze({
  ok:attempted&&readback&&cleaned&&!failCode,
  writeReadback:readback,
  cleaned,
  code:failCode||null,
  // Report the synthetic document path ONLY when cleanup was not confirmed.
  // No private subscription endpoint or key is returned.
  cleanupPath:attempted&&!cleaned?path.join('/'):null
 });
}
