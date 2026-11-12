const prefix='honbin-default-notebook:';
export function readDefaultNotebook(storage,uid){
 if(!uid)return '';
 try{return storage.getItem(prefix+uid)||''}catch{return ''}
}
export function saveDefaultNotebook(storage,uid,groupId,groups){
 if(!uid)throw Error('請先登入');
 if(groupId&&!groups.some(group=>group.id===groupId))throw Error('這本記事簿目前無法使用');
 if(groupId)storage.setItem(prefix+uid,groupId);
 else storage.removeItem(prefix+uid);
}
