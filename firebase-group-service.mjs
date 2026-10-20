// Isolated Firebase test client. No SDK imports, credentials, or automatic
// network calls. All permissions remain authoritative in Firestore Rules.
// NEVER import from CRM main before live testing and explicit approval.
const ROLES=Object.freeze(['ADMIN','EDITOR','VIEWER']);
const safeId=id=>typeof id==='string'&&id.length>0&&id.length<=180&&!/[\/\\]/.test(id);
export function normalizedEmail(input) {
 const value=String(input||'').trim().toLowerCase();
 if(value.length>254||!(/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)))throw Error('INVALID_EMAIL');
 return value;
}
export function groupService({db,sdk,identity}) {
 if(!db||!sdk||!identity||typeof identity.uid!=='string'||!safeId(identity.uid)||
    identity.emailVerified!==true)throw Error('VERIFIED_GOOGLE_IDENTITY_REQUIRED');
 const uid=identity.uid;
 const mail=normalizedEmail(identity.email);
 const {collection,doc,getDocs,getDoc,setDoc,updateDoc,writeBatch,Timestamp}=sdk;
 if(![collection,doc,getDocs,getDoc,setDoc,updateDoc,writeBatch].every(x=>typeof x==='function')||
    !Timestamp||typeof Timestamp.now!=='function')throw Error('SDK_UNAVAILABLE');
 const path=(id)=>{if(!safeId(id))throw Error('INVALID_GROUP_ID');return doc(db,'groups',id)};
 const inbox=(email,id)=>{
   const e=normalizedEmail(email);
   if(!safeId(id))throw Error('INVALID_INVITE_ID');
   return doc(db,'inboxes',e,'invites',id);
 };
 const member=(gid,actor=uid)=>{if(!safeId(actor))throw Error('INVALID_UID');return doc(db,'groups',gid,'members',actor)};
 const pointer=(gid)=>doc(db,'users',uid,'groupIndex',gid);
 const indexBody=(gid)=>({uid,groupId:gid,createdAt:Timestamp.now()});
 async function createGroup(name) {
   const title=String(name||'').trim();
   if(!title||title.length>120)throw Error('INVALID_GROUP_NAME');
   const ref=doc(collection(db,'groups'));
   const batch=writeBatch(db);
   batch.set(ref,{ownerUid:uid,name:title,createdAt:Timestamp.now()});
   batch.set(pointer(ref.id),indexBody(ref.id));
   await batch.commit();
   return {id:ref.id,name:title,role:'ADMIN'};
 }
 async function listGroups() {
   const snapshots=await getDocs(collection(db,'users',uid,'groupIndex'));
   const visible=[];
   for(const item of snapshots.docs) {
     try {
       const g=await getDoc(path(item.id));
       if(!g.exists())continue;
       const role=await myRole(item.id,g);
       if(role)visible.push({id:item.id,name:g.data().name,role});
     }catch(err) {
       // A stale index must NEVER leak the previously visible group name.
       if(err?.code==='permission-denied'||err?.code==='not-found')continue;
       throw err;
     }
   }
   return visible;
 }
 async function myRole(groupId,knownGroup) {
   const g=knownGroup||await getDoc(path(groupId));
   if(!g.exists())return null;
   if(g.data().ownerUid===uid)return 'ADMIN';
   const record=await getDoc(member(groupId));
   if(!record.exists()||record.data().status!=='ACTIVE')return null;
   return ROLES.includes(record.data().role)?record.data().role:null;
 }
 async function sendInvite(groupId,email,role) {
   path(groupId);
   const recipientEmail=normalizedEmail(email);
   if(!ROLES.includes(role))throw Error('INVALID_ROLE');
   const ref=doc(collection(db,'inboxes',recipientEmail,'invites'));
   const b=writeBatch(db);
   b.set(ref,{groupId,recipientEmail,role,status:'PENDING',invitedBy:uid});
   b.set(doc(db,'groups',groupId,'sentInvites',ref.id),{
     groupId,recipientEmail,role,invitedBy:uid,createdAt:Timestamp.now()
   });
   await b.commit();
   return {id:ref.id,recipientEmail,groupId,role,status:'PENDING'};
 }
 async function listSentInvites(groupId) {
   path(groupId);
   const result=await getDocs(collection(db,'groups',groupId,'sentInvites'));
   const output=[];
   for(const entry of result.docs){
     const meta=entry.data();
     const current=await getDoc(inbox(meta.recipientEmail,entry.id));
     if(!current.exists())continue;
     // Do not trust a stale index's status: read the live invitation.
     const actual=current.data();
     if(actual.groupId!==groupId||actual.recipientEmail!==meta.recipientEmail)continue;
     output.push({id:entry.id,...actual});
   }
   return output;
 }
 async function listInbox() {
   const result=await getDocs(collection(db,'inboxes',mail,'invites'));
   return result.docs.map(item=>({id:item.id,...item.data()}));
 }
 async function ensureIndex(groupId) {
   // Never re-index a group after revocation just because an old invite
   // remains ACCEPTED. A server-authorized fresh read is mandatory.
   const authorized=await getDoc(path(groupId));
   if(!authorized.exists())throw Error('GROUP_NOT_FOUND');
   const existing=await getDoc(pointer(groupId));
   if(existing.exists())return true;
   await setDoc(pointer(groupId),indexBody(groupId));
   return true;
 }
 async function acceptInvite(invitation) {
   if(!invitation||!safeId(invitation.id))throw Error('INVALID_INVITE');
   const ref=inbox(mail,invitation.id);
   const snap=await getDoc(ref);
   if(!snap.exists())throw Error('INVITATION_NOT_FOUND');
   const data=snap.data();
   const groupId=data.groupId;
   path(groupId);
   if(data.recipientEmail!==mail||!ROLES.includes(data.role))throw Error('INVALID_INVITE');
   if(data.status==='ACCEPTED'&&data.acceptedUid===uid){
     // Safe recovery after server accepted but Safari missed the ACK.
     await ensureIndex(groupId);
     return {groupId,alreadyAccepted:true,indexed:true};
   }
   if(data.status!=='PENDING')throw Error('INVITATION_NOT_PENDING');
   const batch=writeBatch(db);
   batch.update(ref,{status:'ACCEPTED',acceptedUid:uid});
   batch.set(member(groupId),{uid,role:data.role,status:'ACTIVE',invitationId:invitation.id});
   await batch.commit();
   // Membership and consumed invitation have already succeeded atomically.
   // Pointer is recoverable from the ACCEPTED inbox, not an ACL authority.
   try {
     await ensureIndex(groupId);
     return {groupId,alreadyAccepted:false,indexed:true};
   }catch(error) {
     return {groupId,alreadyAccepted:false,indexed:false,
       reason:String(error?.code||'INDEX_RETRY_NEEDED')};
   }
 }
 async function revokeInvite(email,id) {
   await updateDoc(inbox(email,id),{status:'REVOKED'});
   return true;
 }
 async function listMembers(groupId) {
   path(groupId);
   const snap=await getDocs(collection(db,'groups',groupId,'members'));
   return snap.docs.map(item=>({id:item.id,...item.data()}));
 }
 async function changeMember(groupId,memberUid,change) {
   if(!['ADMIN','EDITOR','VIEWER','REVOKED'].includes(change))throw Error('INVALID_CHANGE');
   if(change==='REVOKED')await updateDoc(member(groupId,memberUid),{status:'REVOKED'});
   else await updateDoc(member(groupId,memberUid),{role:change});
 }
 return Object.freeze({createGroup,listGroups,myRole,sendInvite,listSentInvites,listInbox,
   acceptInvite,revokeInvite,ensureIndex,listMembers,changeMember});
}
