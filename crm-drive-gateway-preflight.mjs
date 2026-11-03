import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {centralDriveClient,attachmentLine,appendAttachment,ATTACHMENT_PREFIX} from './crm-drive-client.mjs';
const code=readFileSync('crm-drive-gateway/Code.gs','utf8');
const props=new Map(),files=new Map();let created=0,allow=true,authValid=true,member=true;
const actor={uid:'synthetic_user',email:'synthetic@example.test'};
const payload={aud:'honbin-crm-notes-spark',iss:'https://securetoken.google.com/honbin-crm-notes-spark',sub:actor.uid,email_verified:true,firebase:{sign_in_provider:'google.com'},exp:Date.now()/1000+1000,auth_time:1};
const token='a.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.z';
const rootId='1hC6sjOpvyO-vHb8QYi5JlEj0o-FP_m5k';
const iter=arr=>{let i=0;return {hasNext:()=>i<arr.length,next:()=>arr[i++]}};
const owner={getEmail:()=> 'honbin002@gmail.com'};
const folder={getName:()=> 'private_'+actor.uid,getId:()=> 'synthetic_folder_12345',getParents:()=>iter([root]),createFile:blob=>{
 created++;let description='';const id='synthetic_file_12345678';
 const file={getId:()=>id,setDescription:d=>description=d,getDescription:()=>description,getSize:()=>blob.bytes.length,getBlob:()=>({getBytes:()=>blob.bytes}),getParents:()=>iter([folder]),isTrashed:()=>false};files.set(id,file);return file;
}};
const root={getName:()=> 'CRM',getOwner:()=>owner,getId:()=>rootId,getFoldersByName:()=>iter([folder])};
const sandbox={console,ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},Session:{getEffectiveUser:()=>owner},
 Utilities:{base64Decode:s=>[...Buffer.from(s,'base64')],base64DecodeWebSafe:s=>[...Buffer.from(s,'base64url')],base64Encode:b=>Buffer.from(b).toString('base64'),newBlob:(bytes,mime,name)=>({bytes,mime,name,getDataAsString:()=>Buffer.from(bytes).toString('utf8')}),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,bytes)=>[...createHash('sha256').update(Buffer.from(bytes)).digest()]},
 DriveApp:{getFolderById:id=>{assert.equal(id,rootId);return root},getFileById:id=>{if(!files.has(id))throw Error('FILE_MISSING');return files.get(id)}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),getProperties:()=>Object.fromEntries(props),deleteProperty:k=>props.delete(k)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},CacheService:{getScriptCache:()=>({get:()=>null,put:()=>{}})},
 UrlFetchApp:{fetch:(url,opt)=>{
  let status=200,data={};
  if(url.startsWith('https://identitytoolkit.googleapis.com/')){status=authValid?200:400;data={users:[{localId:actor.uid,email:actor.email,emailVerified:true,validSince:'0'}]}}
  else if(url.includes('/notes?'))status=allow?200:403;
  else if(url.includes('/members/')){status=member?200:403;data={fields:{uid:{stringValue:actor.uid},status:{stringValue:'ACTIVE'},role:{stringValue:'VIEWER'}}}}
  else if(url.includes('/groups/')){data={fields:{name:{stringValue:'Synthetic'}}}}
  else throw Error('UNEXPECTED_FETCH');
  return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(data)};
 }}
};
const ctx=vm.createContext(sandbox);vm.runInContext(code,ctx);
const post=p=>ctx.doPost({postData:{length:JSON.stringify(p).length,contents:JSON.stringify(p)}});
const bytes=Buffer.from('synthetic attachment'),request={action:'upload',idToken:token,mode:'PRIVATE',requestId:Date.now()+'_'+'a'.repeat(32),name:'synthetic.txt',mime:'text/plain',size:bytes.length,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')};
assert.equal(post({...request,idToken:''}).code,'LOGIN_REQUIRED');assert.equal(created,0);
allow=false;assert.equal(post(request).code,'ACCOUNT_NOT_APPROVED');assert.equal(created,0);allow=true;
authValid=false;assert.equal(post(request).code,'LOGIN_REQUIRED');authValid=true;
member=false;assert.equal(post({...request,mode:'SHARED',groupId:'synthetic_group'}).code,'GROUP_ACCESS_DENIED');member=true;
assert.equal(post({...request,sha256:'b'.repeat(64)}).code,'FILE_CHECKSUM_MISMATCH');
const uploaded=post(request);assert.equal(uploaded.ok,true);assert.equal(created,1);
assert.equal(post(request).result.id,uploaded.result.id);assert.equal(created,1,'retry is idempotent');
assert.equal(post({...request,name:'changed.txt'}).code,'UPLOAD_REQUEST_CHANGED');
const ref=uploaded.result;
assert.equal(post({action:'read',idToken:token,mode:'PRIVATE',fileId:ref.id}).result.data,request.data);
assert.equal(post({action:'read',idToken:token,mode:'SHARED',groupId:'synthetic_group',fileId:ref.id}).code,'FILE_ACCESS_DENIED');
allow=false;assert.equal(post({action:'read',idToken:token,mode:'PRIVATE',fileId:ref.id}).code,'ACCOUNT_NOT_APPROVED');allow=true;
assert.equal(attachmentLine(ATTACHMENT_PREFIX+JSON.stringify(ref)).id,ref.id);
assert.equal(appendAttachment(appendAttachment('memo',ref),ref),appendAttachment('memo',ref));
assert.equal(attachmentLine(ATTACHMENT_PREFIX+JSON.stringify({...ref,id:'../../etc'})),null);
assert.doesNotMatch(code,/setSharing|addViewer|addEditor|ANYONE|console\.log/);
// Client: same selected file keeps request ID after an unknown network ACK.
let requests=[],fail=true,clientUid='synthetic_user';
const file=new Blob([bytes],{type:'text/plain'});Object.defineProperty(file,'name',{value:'synthetic.txt'});
const client=centralDriveClient({endpoint:'https://script.google.com/macros/s/synthetic_gateway/exec',currentUser:()=>({uid:clientUid,getIdToken:async()=>token}),fetchImpl:async(url,opt)=>{
 assert(!url.includes(token));assert.equal(opt.credentials,'omit');
 const data=JSON.parse(opt.body);requests.push(data);
 if(fail){fail=false;throw Error('synthetic timeout')}
 return {ok:true,json:async()=>({ok:true,result:ref})};
}});
await assert.rejects(()=>client.upload(file,{mode:'PRIVATE'}),/synthetic timeout/);
await client.upload(file,{mode:'PRIVATE'});assert.equal(requests[0].requestId,requests[1].requestId);
const before=requests.length;await client.upload(file,{mode:'PRIVATE'});assert.equal(requests.length,before);
clientUid='different_user';await assert.rejects(()=>client.upload(file,{mode:'PRIVATE'}),/UPLOAD_CONTEXT_CHANGED/);
console.log('CRM_CENTRAL_DRIVE_AUTH_SCOPE_IDEMPOTENCY_AND_CLIENT_RECOVERY_PASS');
