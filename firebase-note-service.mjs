// HONBIN CRM isolated Firebase note engine. No Firebase initialization,
// deployment, storage migration, or live network calls on import.
// Firestore Security Rules remain the final authority for all access.
const ID=/^[A-Za-z0-9_-]{1,150}$/;
function validId(value,code='INVALID_ID'){
  if(typeof value!=='string'||!ID.test(value))throw Error(code);
  return value;
}
const conflict=(current)=>{
  const e=Error('NOTE_VERSION_CONFLICT');
  e.code='NOTE_VERSION_CONFLICT';
  e.remote=current?Object.freeze({
    title:current.title,content:current.content,version:current.version,
    updatedAt:current.updatedAt,deleted:current.deleted
  }):null;
  return e;
};
function textBody(title,content){
  if(typeof title!=='string'||typeof content!=='string')throw Error('INVALID_NOTE_TEXT');
  const name=title.trim()||'未命名記事';
  // Rules enforce length too; no HTML is ever interpreted.
  if(name.length>120||content.length<1||content.length>30000)throw Error('INVALID_NOTE_LENGTH');
  return {title:name,content};
}
export function noteService({db,sdk,identity,currentUid}){
  if(!db||!sdk||!identity||identity.emailVerified!==true||
    identity.providerId!=='google.com')throw Error('VERIFIED_GOOGLE_IDENTITY_REQUIRED');
  const uid=validId(identity.uid,'INVALID_UID');
  if(typeof currentUid!=='function')throw Error('LIVE_IDENTITY_CHECK_REQUIRED');
  const {collection,doc,getDocs,runTransaction,Timestamp}=sdk;
  if(![collection,doc,getDocs,runTransaction].every(f=>typeof f==='function')||
     typeof Timestamp?.now!=='function')throw Error('FIRESTORE_SDK_UNAVAILABLE');
  function verifySession(){
    if(currentUid()!==uid)throw Error('GOOGLE_ACCOUNT_CHANGED');
  }
  function scope(mode,groupId){
    verifySession();
    if(mode==='PRIVATE')return {mode,groupId:null,base:['users',uid,'notes']};
    if(mode==='SHARED')return {mode,groupId:validId(groupId,'INVALID_GROUP_ID'),
      base:['groups',groupId,'notes']};
    throw Error('INVALID_NOTE_SCOPE');
  }
  function collectionRef(target){return collection(db,...target.base)}
  function noteRef(target,noteId){return doc(db,...target.base,validId(noteId,'INVALID_NOTE_ID'))}
  function serialize(snapshot){
    return {id:snapshot.id,...snapshot.data()};
  }
  // Clients must keep this ID in their pending form while an ACK is unknown.
  // A second create on the same ID can never produce a duplicate document.
  function newId({mode,groupId}){
    const target=scope(mode,groupId);return doc(collectionRef(target)).id;
  }
  async function list({mode,groupId,search=''}) {
    const target=scope(mode,groupId);
    const query=String(search||'').toLocaleLowerCase('zh-Hant');
    const result=await getDocs(collectionRef(target));
    verifySession();
    return result.docs.map(serialize)
      .filter(n=>!n.deleted&&(!query||`${n.title}\n${n.content}`.toLocaleLowerCase('zh-Hant').includes(query)))
      .sort((a,b)=>(b.updatedAt?.toMillis?.()||0)-(a.updatedAt?.toMillis?.()||0));
  }
  async function create({mode,groupId,noteId,title,content}){
    const target=scope(mode,groupId),ref=noteRef(target,noteId);
    const payload=textBody(title,content);
    return runTransaction(db,async tx=>{
      verifySession();
      const previous=await tx.get(ref);
      verifySession();
      if(previous.exists()){
        const prior=previous.data();
        // ACK recovery is allowed only while the initial V1 content
        // still matches exactly. Never overwrite a newer note.
        if(prior.ownerUid===uid&&prior.version===1&&!prior.deleted&&
           prior.title===payload.title&&prior.content===payload.content)
          return {id:ref.id,version:1,alreadyCreated:true};
        throw conflict(prior);
      }
      const now=Timestamp.now();
      tx.set(ref,{ownerUid:uid,groupId:target.groupId,...payload,
        createdAt:now,updatedAt:now,version:1,deleted:false});
      return {id:ref.id,version:1,alreadyCreated:false};
    });
  }
  async function write({mode,groupId,noteId,expectedVersion,title,content,remove=false}){
    const target=scope(mode,groupId),ref=noteRef(target,noteId);
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw Error('INVALID_EXPECTED_VERSION');
    const payload=remove?null:textBody(title,content);
    return runTransaction(db,async tx=>{
      verifySession();
      const prev=await tx.get(ref);
      verifySession();
      if(!prev.exists())throw conflict(null);
      const before=prev.data();
      if(before.deleted||before.version!==expectedVersion)throw conflict(before);
      if((target.mode==='PRIVATE'&&before.ownerUid!==uid)||
         before.groupId!==target.groupId)throw Error('NOTE_SCOPE_CHANGED');
      const changes=remove?
        {deleted:true,updatedAt:Timestamp.now(),version:expectedVersion+1}:
        {...payload,updatedAt:Timestamp.now(),version:expectedVersion+1};
      tx.update(ref,changes);
      return {id:ref.id,version:expectedVersion+1,deleted:!!remove};
    });
  }
  const update=options=>write({...options,remove:false});
  const softDelete=options=>write({...options,remove:true});
  return Object.freeze({newId,list,create,update,softDelete});
}
