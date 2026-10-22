// TEST-only privileged member control. Existing Firestore Rules are
// authoritative. No network calls occur on import. Never touches CRM PROD.
export const ROOT_OWNER_EMAIL='honbin002@gmail.com';
const ROLES=Object.freeze(['VIEWER','EDITOR','ADMIN']);
const ID=/^[A-Za-z0-9_-]{1,150}$/;
const id=(v,label)=>{if(typeof v!=='string'||!ID.test(v))throw Error('INVALID_'+label);return v};
const sameEmail=(a,b)=>String(a||'').toLowerCase()===String(b||'').toLowerCase();
export const isRootOwnerIdentity=identity=>Boolean(identity &&
 identity.emailVerified===true&&identity.providerId==='google.com'&&
 sameEmail(identity.email,ROOT_OWNER_EMAIL)&&typeof identity.uid==='string'&&ID.test(identity.uid));

export function ownerMemberService({db,sdk,identity,currentUid}){
 if(!db||!sdk||typeof currentUid!=='function'||!isRootOwnerIdentity(identity))
   throw Error('VERIFIED_ROOT_OWNER_REQUIRED');
 const {doc,collection,getDocs,getDocFromServer,runTransaction,setDoc,updateDoc,serverTimestamp}=sdk;
 if(![doc,collection,getDocs,getDocFromServer,runTransaction].every(x=>typeof x==='function'))
   throw Error('MEMBERSHIP_SDK_REQUIRED');
 const uid=id(identity.uid,'UID');
 const guard=()=>{if(currentUid()!==uid)throw Error('ACCOUNT_CHANGED')};
 const groupRef=groupId=>doc(db,'groups',id(groupId,'GROUP_ID'));
 const memberRef=(groupId,memberUid)=>doc(db,'groups',id(groupId,'GROUP_ID'),'members',id(memberUid,'MEMBER_UID'));
 const sentRef=(groupId,inviteId)=>doc(db,'groups',id(groupId,'GROUP_ID'),'sentInvites',id(inviteId,'INVITE_ID'));
 const inviteRef=(email,inviteId)=>doc(db,'inboxes',String(email).toLowerCase(),'invites',id(inviteId,'INVITE_ID'));
 const approvalEmail=value=>{
  const v=String(value||'').trim().toLowerCase();
  if(v===ROOT_OWNER_EMAIL||v.length>254||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
   throw Error('INVALID_APPROVAL_EMAIL');
  return v;
 };
 const approvalRef=email=>doc(db,'approvedAccounts',approvalEmail(email));
 const groupOkay=(data)=>data&&data.ownerUid===uid&&
   typeof data.name==='string'&&data.name&&
   !Object.prototype.hasOwnProperty.call(data,'deleteState');

 async function requireOwnedGroup(groupId){
  guard();
  const snap=await getDocFromServer(groupRef(groupId));guard();
  if(!snap.exists()||!groupOkay(snap.data()))throw Error('OWNER_GROUP_REQUIRED');
  return {id:groupId,name:snap.data().name};
 }
 async function ownedGroups(summaries){
  guard();if(!Array.isArray(summaries))throw Error('GROUP_DIRECTORY_REQUIRED');
  const owned=[];
  for(const candidate of summaries){
   if(!candidate||typeof candidate.id!=='string'||!ID.test(candidate.id))continue;
   try{owned.push(await requireOwnedGroup(candidate.id))}
   catch(e){if(e?.message==='OWNER_GROUP_REQUIRED'||e?.code==='permission-denied')continue;throw e}
  }
  return owned;
 }
 async function roster(groupId){
  const group=await requireOwnedGroup(groupId);
  const snaps=await Promise.all([
   getDocs(collection(db,'groups',group.id,'members')),
   getDocs(collection(db,'groups',group.id,'sentInvites'))
  ]);guard();
  const inviteIndex=new Map(snaps[1].docs.map(d=>[d.id,d.data()]));
  const rows=[];
  for(const record of snaps[0].docs){
   const data=record.data(),memberUid=record.id;
   if(data.uid!==memberUid||memberUid===uid||!ROLES.includes(data.role))continue;
   const link=inviteIndex.get(data.invitationId);
   let email='',verified=false;
   if(link&&link.groupId===group.id&&typeof link.recipientEmail==='string'&&
      link.recipientEmail.includes('@')&&data.status==='ACTIVE'){
    try{
     const invitation=await getDocFromServer(inviteRef(link.recipientEmail,data.invitationId));
     guard();
     verified=invitation.exists()&&invitation.data().status==='ACCEPTED'&&
      invitation.data().acceptedUid===memberUid&&
      invitation.data().groupId===group.id&&
      sameEmail(invitation.data().recipientEmail,link.recipientEmail);
     if(verified)email=link.recipientEmail;
    }catch(e){if(e?.code!=='permission-denied')throw e}
   }
   rows.push({uid:memberUid,role:data.role,status:data.status,
    invitationId:data.invitationId,email,
    editable:verified&&data.status==='ACTIVE'});
  }
  rows.sort((a,b)=>(a.email||a.uid).localeCompare(b.email||b.uid,'zh-TW'));
  return {group,members:rows};
 }
 async function changeRole({groupId,memberUid,invitationId,recipientEmail,expectedRole,nextRole}){
  guard();
  id(groupId,'GROUP_ID');id(memberUid,'MEMBER_UID');id(invitationId,'INVITE_ID');
  if(memberUid===uid||!ROLES.includes(expectedRole)||!ROLES.includes(nextRole)||
     nextRole===expectedRole||typeof recipientEmail!=='string'||!recipientEmail.includes('@'))
    throw Error('INVALID_ROLE_CHANGE');
  const group=groupRef(groupId),member=memberRef(groupId,memberUid),
   sent=sentRef(groupId,invitationId),inbox=inviteRef(recipientEmail,invitationId);
  await runTransaction(db,async tx=>{
   guard();
   const groupSnap=await tx.get(group),memberSnap=await tx.get(member),
    sentSnap=await tx.get(sent),inviteSnap=await tx.get(inbox);
   guard();
   if(!groupSnap.exists()||!groupOkay(groupSnap.data()))throw Error('OWNER_GROUP_REQUIRED');
   if(!memberSnap.exists()||memberSnap.data().uid!==memberUid||
      memberSnap.data().status!=='ACTIVE'||memberSnap.data().role!==expectedRole||
      memberSnap.data().invitationId!==invitationId)throw Error('MEMBERSHIP_CHANGED_STOP');
   if(!sentSnap.exists()||sentSnap.data().groupId!==groupId||
      !sameEmail(sentSnap.data().recipientEmail,recipientEmail))
    throw Error('INVITATION_LINK_MISMATCH');
   if(!inviteSnap.exists()||inviteSnap.data().groupId!==groupId||
      inviteSnap.data().acceptedUid!==memberUid||inviteSnap.data().status!=='ACCEPTED'||
      !sameEmail(inviteSnap.data().recipientEmail,recipientEmail))
    throw Error('ACCEPTED_INVITE_MISMATCH');
   tx.update(member,{role:nextRole}); // The ONLY mutation; no invites or notes touched.
  });
  guard();
  const after=await getDocFromServer(member);guard();
  if(!after.exists()||after.data().role!==nextRole||after.data().status!=='ACTIVE')
   throw Error('ROLE_CHANGE_READBACK_NOT_CONFIRMED');
  return {groupId,memberUid,email:recipientEmail,previousRole:expectedRole,role:nextRole};
 }

 // Global account approval and notebook invitation are intentionally distinct.
 // Only the root owner's Firebase UID can write approvedAccounts under Rules.
 // Re-check the exact server-authorized, unrevoked invitation before enabling.
 async function verifiedInviteForApproval({groupId,invitationId,recipientEmail}){
  guard();
  const email=approvalEmail(recipientEmail);
  await requireOwnedGroup(groupId);guard();
  const [sentSnap,inboxSnap]=await Promise.all([
   getDocFromServer(sentRef(groupId,invitationId)),
   getDocFromServer(inviteRef(email,invitationId))
  ]);guard();
  if(!sentSnap.exists()||!inboxSnap.exists())throw Error('INVITATION_NOT_FOUND');
  const sent=sentSnap.data(),invite=inboxSnap.data();
  if(sent.groupId!==groupId||invite.groupId!==groupId||
   !sameEmail(sent.recipientEmail,email)||!sameEmail(invite.recipientEmail,email)||
   !ROLES.includes(sent.role)||invite.role!==sent.role||
   !['PENDING','ACCEPTED'].includes(invite.status))
    throw Error('INVITATION_NOT_ELIGIBLE');
  return email;
 }
 async function accountApprovalStatus(args){
  const email=await verifiedInviteForApproval(args);
  const snap=await getDocFromServer(approvalRef(email));guard();
  if(!snap.exists())return {email,status:'NOT_APPROVED'};
  if(!sameEmail(snap.data().email,email)||
   !['ACTIVE','REVOKED'].includes(snap.data().status))
    throw Error('APPROVAL_DOCUMENT_INVALID');
  return {email,status:snap.data().status};
 }
 async function approveInvitedAccount(args){
  if(![setDoc,updateDoc,serverTimestamp].every(x=>typeof x==='function'))
   throw Error('APPROVAL_WRITE_SDK_REQUIRED');
  const status=await accountApprovalStatus(args);guard();
  if(status.status==='ACTIVE')return {email:status.email,status:'ACTIVE',alreadyActive:true};
  const ref=approvalRef(status.email);
  if(status.status==='NOT_APPROVED')
   await setDoc(ref,{email:status.email,status:'ACTIVE',createdAt:serverTimestamp()});
  else if(status.status==='REVOKED')
   await updateDoc(ref,{status:'ACTIVE'});
  guard();
  const readback=await getDocFromServer(ref);guard();
  if(!readback.exists()||!sameEmail(readback.data().email,status.email)||
   readback.data().status!=='ACTIVE')
    throw Error('APPROVAL_READBACK_FAILED');
  return {email:status.email,status:'ACTIVE',alreadyActive:false};
 }
 return Object.freeze({ownedGroups,roster,changeRole,accountApprovalStatus,approveInvitedAccount});
}
