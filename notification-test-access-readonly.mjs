// Explicitly manual TEST-only diagnostic. It never writes Firestore data or sends push.
// The credential must come from a private Actions secret, never repository source.
const projectId='honbin-crm-notes-spark';
const accountEmail=`honbin-test-push-sender@${projectId}.iam.gserviceaccount.com`;
const raw=process.env.TEST_FIREBASE_SERVICE_ACCOUNT_JSON;
if(!raw)throw Error('MISSING_TEST_CREDENTIAL_STOP');
let credential;
try{credential=JSON.parse(raw)}catch{throw Error('INVALID_TEST_CREDENTIAL_JSON_STOP')}
if(credential.project_id!==projectId||credential.client_email!==accountEmail)
 throw Error('WRONG_TEST_SERVICE_ACCOUNT_STOP');
// Report only the class of credential failure. Never print any key material.
if(credential.type!=='service_account'||typeof credential.private_key!=='string'||!credential.private_key.includes('-----BEGIN PRIVATE KEY-----'))
 throw Error('TEST_SERVICE_ACCOUNT_PRIVATE_KEY_MISSING_STOP');
if(!credential.private_key.includes('\n')&&credential.private_key.includes('\\n'))
 throw Error('TEST_PRIVATE_KEY_NEWLINES_DOUBLE_ESCAPED_STOP');
const [{initializeApp,cert,deleteApp},{getAuth},{getFirestore,Timestamp,FieldPath}]=await Promise.all([
 import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/firestore')
]);
let app;
try{app=initializeApp({credential:cert(credential),projectId})}
catch{throw Error('INVALID_TEST_CREDENTIAL_STOP')}
const db=getFirestore(app);
// A single Auth page verifies that the dedicated role can read identities.
// Neither the account identity nor record content is printed.
try{await getAuth(app).listUsers(1)}
catch{throw Error('TEST_AUTH_READ_FAILED_STOP')}
console.log('TEST_AUTH_READ_OK');
const streams=[
 ['TASK_CREATED','tasks','createdAt'],
 ['TASK_COMPLETED','tasks','completedAt'],
 ['NOTE_CREATED','notes','createdAt']
];
for(const [label,collection,field] of streams){
 try{
  await db.collectionGroup(collection)
   .where(field,'>=',Timestamp.fromMillis(0))
   .orderBy(field,'asc')
   .orderBy(FieldPath.documentId(),'asc')
   .limit(1).get();
  console.log(`TEST_${label}_QUERY_OK`);
 }catch(error){
  // Firestore errors can contain index URLs or details; never print them here.
  console.error(`TEST_${label}_QUERY_FAILED`,error.code||'unknown');
  process.exitCode=1;
 }
}
await deleteApp(app);
