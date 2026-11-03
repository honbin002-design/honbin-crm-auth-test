// Central Drive gateway transport. Firebase ID token stays in POST body only.
export const ATTACHMENT_PREFIX='📎 CRM附件 ';
export const MAX_ATTACHMENT_BYTES=20*1024*1024;
export const MAX_ATTACHMENTS=10;
export function attachmentLine(line){
 if(!String(line).startsWith(ATTACHMENT_PREFIX))return null;
 try{
  const x=JSON.parse(line.slice(ATTACHMENT_PREFIX.length));
  if(!x||!/^[A-Za-z0-9_-]{15,150}$/.test(x.id)||typeof x.name!=='string'||x.name.length>180||typeof x.mime!=='string'||!/^[a-z0-9.+_-]+\/[a-z0-9.+_-]+$/i.test(x.mime)||!Number.isSafeInteger(x.size)||x.size<1||x.size>MAX_ATTACHMENT_BYTES)return null;
  return {id:x.id,name:x.name,mime:x.mime,size:x.size};
 }catch{return null}
}
export function appendAttachment(content,file){
 const encoded=ATTACHMENT_PREFIX+JSON.stringify(file),parsed=attachmentLine(encoded);
 if(!parsed)throw Error('INVALID_ATTACHMENT');
 const text=String(content||''),existing=text.split('\n').map(attachmentLine).filter(Boolean);
 if(existing.some(x=>x.id===file.id))return text;
 if(existing.length>=MAX_ATTACHMENTS)throw Error('每筆記事最多 10 個上傳附件');
 const next=text+(text?'\n':'')+encoded;if(next.length>30000)throw Error('記事內容已達長度上限');return next;
}
export function attachmentError(error){
 const code=String(error?.message||'');
 return ({LOGIN_REQUIRED:'登入已失效，請重新登入後重試。',ACCOUNT_NOT_APPROVED:'此帳號尚未核准或已停用，無法上傳。',GROUP_ACCESS_DENIED:'你已無法存取這本共用記事簿。',FILE_ACCESS_DENIED:'你沒有這個附件的查看權限。',UPLOAD_RESULT_UNCERTAIN:'上傳結果尚未確認，為避免重複已停止重傳。請保留畫面並通知管理員核對。',UPLOAD_RATE_LIMIT:'目前上傳較頻繁，請五分鐘後再試。',GATEWAY_NOT_CONFIGURED:'集中上傳服務尚未完成設定。',GATEWAY_FAILED:'集中上傳服務未能完成，請保留目前頁面並通知管理員。'})[code]||code||'上傳未確認，請保留目前頁面重試。';
}
export function centralDriveClient({endpoint,currentUser,fetchImpl=globalThis.fetch}){
 const slots=new WeakMap();
 async function request(payload,expectedUid){
  const user=currentUser();if(!user||user.uid!==expectedUid)throw Error('ACCOUNT_CHANGED');
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint||''))throw Error('GATEWAY_NOT_CONFIGURED');
  const idToken=await user.getIdToken();if(currentUser()?.uid!==expectedUid)throw Error('ACCOUNT_CHANGED');
  const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer',body:JSON.stringify({...payload,idToken}),signal:AbortSignal.timeout(120000)});
  if(currentUser()?.uid!==expectedUid)throw Error('ACCOUNT_CHANGED');
  if(!response.ok)throw Error('集中上傳服務回應失敗（'+response.status+'）');
  let data;try{data=await response.json()}catch{throw Error('集中上傳服務回應格式錯誤，請通知管理員。')}
  if(!data.ok)throw Error(data.code||'GATEWAY_FAILED');return data;
 }
 async function upload(file,scope,assertContext=()=>{}){
  if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_ATTACHMENT_BYTES)throw Error('每個檔案需介於 1 byte 與 20 MB');
  const user=currentUser();if(!user)throw Error('LOGIN_REQUIRED');
  const uid=user.uid,key=JSON.stringify(scope);let slot=slots.get(file);
  if(slot&&(slot.uid!==uid||slot.scope!==key))throw Error('UPLOAD_CONTEXT_CHANGED');
  if(!slot){slot={uid,scope:key,id:Date.now()+'_'+crypto.randomUUID().replaceAll('-',''),result:null};slots.set(file,slot)}
  assertContext();if(slot.result)return slot.result;
  const buffer=await file.arrayBuffer();assertContext();
  const hash=await crypto.subtle.digest('SHA-256',buffer);assertContext();
  const sha256=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
  // Chunk conversion avoids spreading a large photo onto the JS call stack.
  const bytes=new Uint8Array(buffer);let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const result=await request({action:'upload',...scope,requestId:slot.id,name:file.name.slice(0,180),mime:file.type||'application/octet-stream',size:file.size,sha256,data:btoa(binary)},uid);assertContext();
  if(!attachmentLine(ATTACHMENT_PREFIX+JSON.stringify(result.result)))throw Error('INVALID_ATTACHMENT');
  slot.result=result.result;return slot.result;
 }
 async function read(file,scope){
  const user=currentUser();if(!user)throw Error('LOGIN_REQUIRED');
  const response=await request({action:'read',...scope,fileId:file.id},user.uid),result=response.result;
  if(result?.id!==file.id||result.size!==file.size||result.mime!==file.mime||typeof result.data!=='string')throw Error('附件讀回核對失敗');
  const binary=atob(result.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  if(bytes.length!==file.size)throw Error('附件大小核對失敗');return new Blob([bytes],{type:file.mime});
 }
 return Object.freeze({upload,read,check:scope=>request({action:'check',...scope},currentUser()?.uid)});
}
