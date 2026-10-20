// TEST-only live Firestore read-denial probes. No writes of any kind.
// Paths are deliberately nonmember/nonowner; expected result is permission-denied.
// Import has no SDK initialization, authorization changes or network effects.
const ID=/^[A-Za-z0-9_-]{1,150}$/;
const DENIED_GROUP='__nonexistent_rule_check_group_20261021';
const DENIED_UID='__nonexistent_external_uid_20261021';
const denial=error=>error?.code==='permission-denied'||
  error?.code==='firestore/permission-denied';
export async function verifyLiveReadDenials({db,sdk,currentUid}){
 if(!db||!sdk||typeof currentUid!=='function'||
   !['doc','collection','getDocFromServer','getDocsFromServer']
    .every(key=>typeof sdk[key]==='function'))
  throw Error('LIVE_READ_DENIAL_CONTEXT_REQUIRED');
 const actor=currentUid();
 if(typeof actor!=='string'||!ID.test(actor)||actor===DENIED_UID)
  throw Error('VERIFIED_TEST_ACCOUNT_REQUIRED');
 const unchanged=()=>{if(currentUid()!==actor)throw Error('ACCOUNT_CHANGED')};
 const probes=[
  {
   label:'禁止列出所有公開暱稱',
   read:()=>sdk.getDocsFromServer(sdk.collection(db,'profiles'))
  },
  {
   label:'禁止讀取其他人的私人推播訂閱',
   read:()=>sdk.getDocFromServer(sdk.doc(db,'pushSubscriptions',DENIED_UID,'devices','synthetic_device'))
  },
  {
   label:'禁止讀取未加入群組的任務列表',
   read:()=>sdk.getDocsFromServer(sdk.collection(db,'groups',DENIED_GROUP,'tasks'))
  }
 ];
 const results=[];
 for(const probe of probes){
  unchanged();
  try{
   await probe.read();unchanged();
   results.push({label:probe.label,status:'UNEXPECTED_ALLOWED'});
  }catch(error){
   unchanged();
   results.push({label:probe.label,status:denial(error)?'SERVER_DENIED_PASS':'HOLD',
     ...(denial(error)?{}:{errorCode:String(error?.code||error?.message||'unknown')})});
  }
 }
 return Object.freeze({ok:results.every(x=>x.status==='SERVER_DENIED_PASS'),
  results:Object.freeze(results.map(x=>Object.freeze(x)))});
}
