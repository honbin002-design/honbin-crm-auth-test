// Pure notebook directory and permission policy. No Firebase or Drive network calls.
// One Firestore group represents exactly one shared notebook; membership is scoped by group ID.
const ROLES=Object.freeze(['ADMIN','EDITOR','VIEWER']);
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=180&&!/[\/\\]/.test(id);
export function resolveNotebookSelection(groups,previousId=null){
  if(!Array.isArray(groups))throw Error('NOTEBOOK_DIRECTORY_REQUIRED');
  const seen=new Set(),items=[];
  for(const group of groups){
    if(!group||!validId(group.id)||typeof group.name!=='string'||
       !group.name.trim()||group.name.length>120||!ROLES.includes(group.role))continue;
    if(seen.has(group.id))continue;
    seen.add(group.id);
    items.push({id:group.id,name:group.name.trim(),role:group.role});
  }
  items.sort((a,b)=>a.name.localeCompare(b.name,'zh-TW')||a.id.localeCompare(b.id));
  const selected=items.find(x=>x.id===previousId)||items[0]||null;
  return {items,selected};
}
export function notebookCapabilities(role){
  return Object.freeze({
    canRead:ROLES.includes(role),
    canWrite:role==='ADMIN'||role==='EDITOR',
    canManageMembers:role==='ADMIN',
    canDeleteSharedNote:role==='ADMIN',
    // The Drive attachment feature is not live. No role can bypass this gate.
    canUploadAttachment:false
  });
}
export function notebookRoleLabel(role){
  return ({ADMIN:'管理員',EDITOR:'編輯者',VIEWER:'檢視者'})[role]||'未授權';
}
