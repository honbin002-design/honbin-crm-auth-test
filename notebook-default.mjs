const prefix='honbin-default-notebook:';
const preferenceKey=(uid,section)=>prefix+uid+(section==='notes'?'':':'+section);
export function readDefaultNotebook(storage,uid,section='notes'){
 if(!uid)return '';
 try{return storage.getItem(preferenceKey(uid,section))||''}catch{return ''}
}
export function saveDefaultNotebook(storage,uid,groupId,groups,section='notes'){
 if(!uid)throw Error('請先登入');
 if(groupId&&!groups.some(group=>group.id===groupId))throw Error('這本記事簿目前無法使用');
 if(groupId)storage.setItem(preferenceKey(uid,section),groupId);
 else storage.removeItem(preferenceKey(uid,section));
}
