/* HONBIN CRM central Drive gateway v1. Files never become public.
 * Deploy as honbin002@gmail.com; Firebase rules remain account/scope authority.
 * Never logs tokens, file bytes or business data. No paid services or triggers.
 */
var CRM={folder:'1hC6sjOpvyO-vHb8QYi5JlEj0o-FP_m5k',owner:'honbin002@gmail.com',project:'honbin-crm-notes-spark',key:'AIzaSyB4EzMwS8hzDiec02jBVAe6ks5T8XiqELo',max:20*1024*1024};
function crmJson_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)}
function doGet(){return crmJson_({ok:true,service:'HONBIN_CRM_DRIVE',version:1,authenticated:false})}
function doPost(e){
 try{
  if(!e||!e.postData||e.postData.length>CRM.max*1.4+20000)throw Error('INVALID_REQUEST');
  var p=JSON.parse(e.postData.contents);
  if(!p||!['upload','read','check'].includes(p.action))throw Error('INVALID_ACTION');
  var actor=crmActor_(p.idToken),scope=crmScope_(p,actor,p.idToken);
  if(p.action==='check'){crmRoot_();return crmJson_({ok:true,scope:scope.key,folderName:'CRM'})}
  var result=p.action==='upload'?crmUpload_(p,actor,scope):crmRead_(p,actor,scope);
  return crmJson_({ok:true,result:result});
 }catch(error){
  var code=String(error&&error.message||'GATEWAY_FAILED');
  if(!/^[A-Z_]{3,80}$/.test(code))code='GATEWAY_FAILED';
  return crmJson_({ok:false,code:code});
 }
}
function crmFetch_(url,options){
 var response=UrlFetchApp.fetch(url,Object.assign({muteHttpExceptions:true},options||{}));
 return {status:response.getResponseCode(),text:response.getContentText()};
}
function crmActor_(token){
 if(typeof token!=='string'||token.length>10000||token.split('.').length!==3)throw Error('LOGIN_REQUIRED');
 // Google's Auth endpoint verifies the token; local JWT decode only checks the
 // verified token's project/provider/expiry, never substitutes for verification.
 var response=crmFetch_('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+CRM.key,{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:token})});
 if(response.status!==200)throw Error('LOGIN_REQUIRED');
 var user=JSON.parse(response.text).users;
 if(!user||user.length!==1||user[0].disabled||user[0].emailVerified!==true)throw Error('LOGIN_REQUIRED');
 var claim=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());
 if(claim.aud!==CRM.project||claim.iss!=='https://securetoken.google.com/'+CRM.project||claim.sub!==user[0].localId||claim.email_verified!==true||!claim.firebase||claim.firebase.sign_in_provider!=='google.com'||claim.exp*1000<=Date.now()||claim.auth_time<Number(user[0].validSince||0))throw Error('LOGIN_REQUIRED');
 var uid=user[0].localId;if(!/^[A-Za-z0-9_-]{1,150}$/.test(uid))throw Error('LOGIN_REQUIRED');
 // Existing rules authorize an own-notes list only for approved Google users.
 // Read at most one version field; require HTTP 200, never infer access from 404.
 var gate=crmFirestore_('users/'+uid+'/notes?pageSize=1&mask.fieldPaths=version',token);
 if(gate.status!==200)throw Error('ACCOUNT_NOT_APPROVED');
 return {uid:uid,email:String(user[0].email||'').toLowerCase()};
}
function crmFirestore_(path,token){return crmFetch_('https://firestore.googleapis.com/v1/projects/'+CRM.project+'/databases/(default)/documents/'+path,{headers:{Authorization:'Bearer '+token}})}
function crmScope_(p,actor,token){
 if(p.mode==='PRIVATE')return {key:'PRIVATE:'+actor.uid,folder:'private_'+actor.uid};
 if(p.mode!=='SHARED'||typeof p.groupId!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(p.groupId))throw Error('INVALID_SCOPE');
 var group=crmFirestore_('groups/'+p.groupId,token);
 var membership=crmFirestore_('groups/'+p.groupId+'/members/'+actor.uid,token);
 if(group.status!==200||membership.status!==200)throw Error('GROUP_ACCESS_DENIED');
 var g=JSON.parse(group.text).fields||{},m=JSON.parse(membership.text).fields||{};
 if(g.deleteState||m.status&&m.status.stringValue!=='ACTIVE'||!m.status||!m.uid||m.uid.stringValue!==actor.uid||!m.role||!['VIEWER','EDITOR','ADMIN'].includes(m.role.stringValue))throw Error('GROUP_ACCESS_DENIED');
 return {key:'SHARED:'+p.groupId,folder:'shared_'+p.groupId};
}
function crmRoot_(){
 if(String(Session.getEffectiveUser().getEmail()).toLowerCase()!==CRM.owner)throw Error('WRONG_GATEWAY_OWNER');
 var root=DriveApp.getFolderById(CRM.folder);
 if(root.getName()!=='CRM'||root.getOwner().getEmail().toLowerCase()!==CRM.owner)throw Error('WRONG_CRM_FOLDER');
 return root;
}
function crmScopeFolder_(scope){
 var root=crmRoot_(),found=root.getFoldersByName(scope.folder);
 if(found.hasNext())return found.next();
 return root.createFolder(scope.folder);
}
function crmHash_(bytes){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(v){return ('0'+((v+256)%256).toString(16)).slice(-2)}).join('')}
function crmMeta_(file){
 var data;try{data=JSON.parse(file.getDescription())}catch(e){throw Error('INVALID_CRM_FILE')}
 if(!data||data.app!=='HONBIN_CRM'||data.version!==1)throw Error('INVALID_CRM_FILE');return data;
}
function crmReference_(file,meta){return {id:file.getId(),name:meta.name,mime:meta.mime,size:meta.size}}
function crmUpload_(p,actor,scope){
 var timestamp=Number(String(p.requestId||'').split('_')[0]);
 if(!/^\d{13}_[a-f0-9]{32}$/.test(p.requestId||'')||Math.abs(Date.now()-timestamp)>86400000)throw Error('UPLOAD_REQUEST_EXPIRED');
 if(typeof p.name!=='string'||!p.name.trim()||p.name.length>180||typeof p.mime!=='string'||!/^[a-z0-9.+_-]+\/[a-z0-9.+_-]+$/i.test(p.mime)||!Number.isInteger(p.size)||p.size<1||p.size>CRM.max||typeof p.data!=='string'||p.data.length>CRM.max*1.34+16||!/^[A-Za-z0-9+/]*={0,2}$/.test(p.data)||!/^[a-f0-9]{64}$/.test(p.sha256||''))throw Error('INVALID_FILE');
 var bytes=Utilities.base64Decode(p.data);
 if(bytes.length!==p.size||crmHash_(bytes)!==p.sha256)throw Error('FILE_CHECKSUM_MISMATCH');
 var key='upload_'+actor.uid+'_'+p.requestId,props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('UPLOAD_BUSY_RETRY');
 try{
  var previous=props.getProperty(key),fingerprint=scope.key+'|'+p.sha256+'|'+p.name+'|'+p.mime;
  if(previous){
   var existing=JSON.parse(previous);
   if(existing.fingerprint!==fingerprint)throw Error('UPLOAD_REQUEST_CHANGED');
   if(!existing.fileId)throw Error('UPLOAD_RESULT_UNCERTAIN');
   var saved=DriveApp.getFileById(existing.fileId);return crmReference_(saved,crmMeta_(saved));
  }
  // Bound property growth while never reopening a request inside its 24h retry window.
  var all=props.getProperties(),n=0;
  Object.keys(all).filter(function(k){return k.indexOf('upload_')===0}).forEach(function(k){
   var rec;try{rec=JSON.parse(all[k])}catch(e){return}
   if(Date.now()-rec.time>2*86400000&&n++<100)props.deleteProperty(k);
  });
  var rateKey='rate_'+actor.uid,cache=CacheService.getScriptCache(),rate=Number(cache.get(rateKey)||0);
  if(rate>=30)throw Error('UPLOAD_RATE_LIMIT');cache.put(rateKey,String(rate+1),300);
  var folder=crmScopeFolder_(scope),meta={app:'HONBIN_CRM',version:1,uid:actor.uid,scope:scope.key,name:p.name,mime:p.mime,size:p.size,requestId:p.requestId};
  // Persist intent BEFORE Drive creation. An unknown result never creates a duplicate.
  props.setProperty(key,JSON.stringify({time:Date.now(),fingerprint:fingerprint,fileId:''}));
  var file=folder.createFile(Utilities.newBlob(bytes,p.mime,p.name));file.setDescription(JSON.stringify(meta));
  props.setProperty(key,JSON.stringify({time:Date.now(),fingerprint:fingerprint,fileId:file.getId()}));
  return crmReference_(file,meta);
 }finally{lock.releaseLock()}
}
function crmRead_(p,actor,scope){
 if(typeof p.fileId!=='string'||!/^[A-Za-z0-9_-]{15,150}$/.test(p.fileId))throw Error('INVALID_FILE_ID');
 var file=DriveApp.getFileById(p.fileId),meta=crmMeta_(file);
 if(meta.scope!==scope.key||file.isTrashed())throw Error('FILE_ACCESS_DENIED');
 var parents=file.getParents(),parent=parents.hasNext()?parents.next():null;
 if(!parent||parent.getName()!==scope.folder)throw Error('FILE_ACCESS_DENIED');
 var roots=parent.getParents();if(!roots.hasNext()||roots.next().getId()!==crmRoot_().getId())throw Error('FILE_ACCESS_DENIED');
 if(file.getSize()>CRM.max)throw Error('FILE_TOO_LARGE');
 return Object.assign(crmReference_(file,meta),{data:Utilities.base64Encode(file.getBlob().getBytes())});
}
