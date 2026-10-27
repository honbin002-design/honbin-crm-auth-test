// Order service v1: explicit Firestore transactions, immutable per-change history.
// Importing this module performs no network requests or writes.
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const ID=/^[A-Za-z0-9_-]{1,150}$/;
const FIELDS=['productName','specification','quantity','unit','supplierName','requesterUid',
 'orderedByUid','orderDate','dueDate','arrivedQuantity','status','note'];
const STATUS=['PENDING','ORDERED','PARTIAL','RECEIVED'];
const str=(v,max=300)=>String(v??'').trim().slice(0,max);
const validId=(v)=>typeof v==='string'&&ID.test(v);
const date=(v)=>v===''||DATE.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const orderStatusLabels=Object.freeze({PENDING:'待訂貨',ORDERED:'已訂貨',
 PARTIAL:'部分到貨',RECEIVED:'已完成'});
export function normalizeOrder(input){
 const d={
  productName:str(input.productName,120),specification:str(input.specification,200),
  quantity:Number(input.quantity),unit:str(input.unit,20),
  supplierName:str(input.supplierName,120),
  requesterUid:str(input.requesterUid,150),
  orderedByUid:str(input.orderedByUid,150),
  orderDate:str(input.orderDate,10),dueDate:str(input.dueDate,10),
  arrivedQuantity:Number(input.arrivedQuantity??0),
  status:str(input.status,20),note:str(input.note,2000)
 };
 if(!d.productName||!d.unit||!d.supplierName||!Number.isFinite(d.quantity)||
  d.quantity<=0||!Number.isFinite(d.arrivedQuantity)||d.arrivedQuantity<0||
  d.arrivedQuantity>d.quantity||!STATUS.includes(d.status)||
  !date(d.orderDate)||!date(d.dueDate)||
  (d.requesterUid&&!validId(d.requesterUid))||
  (d.orderedByUid&&!validId(d.orderedByUid)))throw Error('INVALID_ORDER_FIELDS');
 if(d.status==='RECEIVED'&&d.arrivedQuantity!==d.quantity)
  throw Error('RECEIVED_REQUIRES_FULL_QUANTITY');
 if(d.status==='PARTIAL'&&!(d.arrivedQuantity>0&&d.arrivedQuantity<d.quantity))
  throw Error('PARTIAL_REQUIRES_PARTIAL_QUANTITY');
 if((d.status==='PENDING'||d.status==='ORDERED')&&d.arrivedQuantity!==0)
  throw Error('ARRIVED_QUANTITY_REQUIRES_PARTIAL_OR_RECEIVED');
 if(d.status==='PENDING'&&(d.orderDate||d.orderedByUid))
  throw Error('PENDING_CANNOT_BE_ORDERED');
 return d;
}
export function orderChangeSummary(before,after){
 return FIELDS.filter(k=>!same(before?.[k],after?.[k]))
  .map(field=>({field,before:before?.[field]??null,after:after[field]}));
}
export function orderService({db,sdk,currentUid}){
 const {collection,doc,runTransaction,serverTimestamp,getDocsFromServer,
  query,orderBy,limit,startAfter}=sdk||{};
 if(!db||typeof currentUid!=='function'||
  ![collection,doc,runTransaction,serverTimestamp,getDocsFromServer,query,orderBy,limit,startAfter]
   .every(x=>typeof x==='function'))throw Error('ORDER_SDK_REQUIRED');
 const actor=()=>{const uid=currentUid();if(!validId(uid))throw Error('AUTH_REQUIRED');return uid};
 const orders=groupId=>{if(!validId(groupId))throw Error('INVALID_GROUP');return collection(db,'groups',groupId,'orders')};
 const orderRef=(groupId,orderId)=>{if(!validId(orderId))throw Error('INVALID_ORDER_ID');return doc(orders(groupId),orderId)};
 const history=(groupId,orderId)=>collection(orderRef(groupId,orderId),'history');
 async function create(groupId,input){
  const uid=actor(),details=normalizeOrder(input),ref=doc(orders(groupId));
  const audit=doc(history(groupId,ref.id));
  await runTransaction(db,async tx=>{
   if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
   tx.set(ref,{details,revision:1,createdBy:uid,createdAt:serverTimestamp(),
    updatedBy:uid,updatedAt:serverTimestamp(),lastAuditId:audit.id});
   tx.set(audit,{orderId:ref.id,revision:1,actorUid:uid,changedAt:serverTimestamp(),
    kind:'CREATE',before:{},after:details});
  });
  return ref.id;
 }
 async function update(groupId,orderId,patch,expectedRevision){
  const uid=actor(),ref=orderRef(groupId,orderId),audit=doc(history(groupId,orderId));
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw Error('REVISION_REQUIRED');
  return runTransaction(db,async tx=>{
   const snap=await tx.get(ref);
   if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
   if(!snap.exists())throw Error('ORDER_NOT_FOUND');
   const previous=snap.data();
   if(previous.revision!==expectedRevision)throw Error('ORDER_CHANGED_RELOAD');
   if(!patch||typeof patch!=='object'||Array.isArray(patch)||
    Object.keys(patch).some(k=>!FIELDS.includes(k)))throw Error('INVALID_PATCH');
   const next=normalizeOrder({...previous.details,...patch});
   if(same(next,previous.details))return {changed:false,revision:expectedRevision};
   const revision=expectedRevision+1;
   tx.update(ref,{details:next,revision,updatedBy:uid,
    updatedAt:serverTimestamp(),lastAuditId:audit.id});
   tx.set(audit,{orderId,revision,actorUid:uid,changedAt:serverTimestamp(),
    kind:'UPDATE',before:previous.details,after:next});
   return {changed:true,revision};
  });
 }
 async function listPage(groupId,{cursor=null,size=30}={}){
  const uid=actor();
  if(!Number.isInteger(size)||size<1||size>30)throw Error('INVALID_PAGE_SIZE');
  const clauses=[orderBy('updatedAt','desc')];
  if(cursor)clauses.push(startAfter(cursor));
  clauses.push(limit(size+1));
  const snap=await getDocsFromServer(query(orders(groupId),...clauses));
  if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
  const docs=snap.docs.slice(0,size);
  return {items:docs.map(d=>({id:d.id,...d.data()})),
   cursor:docs.at(-1)||null,hasMore:snap.docs.length>size};
 }
 async function listHistory(groupId,orderId){
  const uid=actor();
  const snap=await getDocsFromServer(query(history(groupId,orderId),
   orderBy('revision','desc'),limit(100)));
  if(actor()!==uid)throw Error('ACCOUNT_CHANGED');
  return snap.docs.map(d=>({id:d.id,...d.data(),
   changes:orderChangeSummary(d.data().before,d.data().after)}));
 }
 return {create,update,listPage,listHistory};
}
