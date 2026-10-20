// Pure conflict-review decision logic. Not a Firestore client.
// No automatic merge, overwrite, or network writes: callers MUST explicitly
// confirm the selected operation, retain stale version for ordinary editing,
// and create a NEW stable note ID when saving a copy.
const ID=/^[A-Za-z0-9_-]{1,150}$/;
export function conflictReview({remote,local,sourceNoteId}){
 if(typeof sourceNoteId!=='string'||!ID.test(sourceNoteId))throw Error('INVALID_SOURCE_NOTE_ID');
 if(!local||typeof local.title!=='string'||typeof local.content!=='string'||
   local.title.length>120||local.content.length>30000)throw Error('INVALID_LOCAL_DRAFT');
 const savedLocal=Object.freeze({title:local.title,content:local.content});
 let cloud=null;
 if(remote!==null&&remote!==undefined){
   if(typeof remote.title!=='string'||typeof remote.content!=='string'||
      remote.title.length>120||remote.content.length>30000||
      !Number.isSafeInteger(remote.version)||remote.version<1||
      typeof remote.deleted!=='boolean')throw Error('INVALID_REMOTE_VERSION');
   cloud=Object.freeze({title:remote.title,content:remote.content,
     version:remote.version,deleted:remote.deleted});
 }
 return Object.freeze({
   sourceNoteId,
   local:savedLocal,
   remote:cloud,
   cloudAvailable:Boolean(cloud&&!cloud.deleted),
   // Can never silently update the conflicting document. A user-initiated
   // "save copy" always creates a different NEW note document.
   availableChoices:Object.freeze(cloud&&!cloud.deleted?
     ['KEEP_DRAFT','LOAD_REMOTE','SAVE_NEW_COPY']:
     ['KEEP_DRAFT','SAVE_NEW_COPY'])
 });
}
export function buildSaveNewCopy(review,newNoteId){
 if(!review||!review.local||!Array.isArray(review.availableChoices)||
   !review.availableChoices.includes('SAVE_NEW_COPY'))throw Error('INVALID_REVIEW');
 if(typeof newNoteId!=='string'||!ID.test(newNoteId)||
   newNoteId===review.sourceNoteId)throw Error('COPY_REQUIRES_DISTINCT_NOTE_ID');
 return Object.freeze({noteId:newNoteId,title:review.local.title,
   content:review.local.content});
}
export function buildRemoteRestore(review){
 if(!review||!review.cloudAvailable||!review.remote||
   !review.availableChoices.includes('LOAD_REMOTE'))throw Error('REMOTE_NOT_AVAILABLE');
 return Object.freeze({id:review.sourceNoteId,version:review.remote.version,
   title:review.remote.title,content:review.remote.content});
}
