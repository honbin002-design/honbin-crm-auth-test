// Isolated, LOCAL-ONLY draft store for iPhone Safari.
// Records are partitioned by verified Firebase UID + note scope and
// NEVER dispatched to Firestore automatically. IndexedDB data is not
// encrypted by this application: a trusted device/passcode is required.
// This uses its own database and NEVER touches existing R73 CRM storage.
const NAME='honbin-crm-notes-local-drafts-v1';
const STORE='drafts';
const SAFE=/^[A-Za-z0-9_-]{1,150}$/;
function id(value,name) {
 if(typeof value!=='string'||!SAFE.test(value))throw Error('INVALID_'+name);
 return value;
}
export function scopeKey({uid,mode,groupId=null}) {
 const u=id(uid,'UID');
 if(mode==='PRIVATE') {
   if(groupId!==null&&groupId!==undefined)throw Error('INVALID_PRIVATE_SCOPE');
   return ['v1',u,'PRIVATE','_'].join('|');
 }
 if(mode==='SHARED')return ['v1',u,'SHARED',id(groupId,'GROUP_ID')].join('|');
 throw Error('INVALID_SCOPE');
}
function copySnapshot(snapshot) {
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw Error('INVALID_DRAFT');
 const {title,content,active=null,pendingCreateId=null}=snapshot;
 if(typeof title!=='string'||title.length>120||
   typeof content!=='string'||content.length>30000)throw Error('INVALID_DRAFT_TEXT');
 if(active!==null&&(
   typeof active!=='object'||!SAFE.test(active.id)||
   !Number.isSafeInteger(active.version)||active.version<1
 ))throw Error('INVALID_DRAFT_VERSION');
 if(pendingCreateId!==null)id(pendingCreateId,'NOTE_ID');
 if(active&&pendingCreateId)throw Error('AMBIGUOUS_DRAFT');
 // No email, token, Firebase credential, or unrelated CRM fields stored.
 return {title,content,active:active?{id:active.id,version:active.version}:null,
   pendingCreateId};
}
export function makeDraftStore({factory,dbName=NAME}={}){
 if(!factory||typeof factory.open!=='function')throw Error('INDEXEDDB_UNAVAILABLE');
 let connection;
 const queues=new Map();
 function open(){
   if(connection)return connection;
   connection=new Promise((resolve,reject)=>{
     let request;
     try{request=factory.open(dbName,1)}
     catch(e){reject(e);return}
     request.onupgradeneeded=()=>{
       const db=request.result;
       if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
     };
     request.onsuccess=()=>resolve(request.result);
     request.onerror=()=>reject(request.error||Error('INDEXEDDB_OPEN_FAILED'));
     request.onblocked=()=>reject(Error('INDEXEDDB_BLOCKED'));
   }).catch(err=>{connection=null;throw err});
   return connection;
 }
 function sequenced(key,work){
   const previous=queues.get(key)||Promise.resolve();
   const current=previous.catch(()=>{}).then(work);
   queues.set(key,current);
   current.then(()=>{if(queues.get(key)===current)queues.delete(key)},
     ()=>{if(queues.get(key)===current)queues.delete(key)});
   return current;
 }
 async function task(mode,action){
   const db=await open();
   return new Promise((resolve,reject)=>{
     let tx,value;
     try{
       tx=db.transaction(STORE,mode);
       const req=action(tx.objectStore(STORE));
       if(req)req.onsuccess=()=>{value=req.result};
       tx.oncomplete=()=>resolve(value);
       tx.onerror=()=>reject(tx.error||Error('INDEXEDDB_TRANSACTION_FAILED'));
       tx.onabort=()=>reject(tx.error||Error('INDEXEDDB_TRANSACTION_ABORTED'));
     }catch(err){reject(err)}
   });
 }
 async function save(context,snapshot){
   const key=scopeKey(context);
   const clean=copySnapshot(snapshot);
   const scope={uid:context.uid,mode:context.mode,
     groupId:context.mode==='PRIVATE'?null:context.groupId};
   return sequenced(key,()=>task('readwrite',store=>store.put({
     key,scope,...clean,savedAt:Date.now()
   }))).then(()=>true);
 }
 function read(context){
   const key=scopeKey(context);
   return sequenced(key,async()=>{
     const raw=await task('readonly',store=>store.get(key));
     if(!raw)return null;
     if(raw.scope?.uid!==context.uid||raw.scope?.mode!==context.mode||
       raw.scope?.groupId!==(context.mode==='PRIVATE'?null:context.groupId))
       throw Error('CORRUPT_SCOPE');
     // Allow only the whitelisted editor fields to leave IndexedDB.
     return copySnapshot(raw);
   });
 }
 function remove(context){
   const key=scopeKey(context);
   return sequenced(key,()=>task('readwrite',store=>store.delete(key))).then(()=>true);
 }
 return Object.freeze({save,read,remove});
}
