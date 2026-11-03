// Google Drive photo links in shared notes. Files and sharing stay in Drive;
// Firestore stores only a canonical link inside the existing text field.
export const DRIVE_PHOTO_PREFIX='📷 ';
export const DRIVE_PHOTO_LIMIT=6;
const DRIVE_ID=/^[A-Za-z0-9_-]{15,150}$/;

export function drivePhoto(input){
  let url;
  try{url=new URL(String(input||'').trim())}catch{throw Error('請貼上 Google Drive 照片分享連結')}
  if(url.protocol!=='https:'||url.hostname!=='drive.google.com'||url.username||url.password||url.port)
    throw Error('僅接受 Google Drive 照片分享連結');
  let id='';
  const path=url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/view)?\/?$/);
  if(path)id=path[1];
  else if(url.pathname==='/open')id=url.searchParams.get('id')||'';
  if(!DRIVE_ID.test(id))throw Error('Google Drive 連結格式不正確，請複製檔案的分享連結');
  return Object.freeze({
    id,
    url:'https://drive.google.com/file/d/'+id+'/view',
    thumbnail:'https://drive.google.com/thumbnail?id='+id+'&sz=w800'
  });
}
export function photoLine(line){
  if(!String(line||'').startsWith(DRIVE_PHOTO_PREFIX))return null;
  try{return drivePhoto(line.slice(DRIVE_PHOTO_PREFIX.length))}catch{return null}
}
export function addDrivePhoto(content,input){
  const photo=drivePhoto(input),text=String(content||'');
  const lines=text.split('\n'),photos=lines.map(photoLine).filter(Boolean);
  if(photos.some(x=>x.id===photo.id))throw Error('這張照片已加入記事');
  if(photos.length>=DRIVE_PHOTO_LIMIT)throw Error('每筆記事最多 6 張照片');
  const result=(text.trimEnd()?text.trimEnd()+'\n':'')+DRIVE_PHOTO_PREFIX+photo.url;
  if(result.length>30000)throw Error('記事內容超過 30000 字');
  return result;
}
export function plainNoteText(content){
  return String(content||'').split('\n').filter(line=>!photoLine(line)).join('\n').trim();
}
