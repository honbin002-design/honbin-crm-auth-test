import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const fragment=readFileSync('firestore-owner-supplier-price-REVIEW-ONLY.rules','utf8');
if(!fragment.includes('match /ownerSupplierPrices/{ownerUid}/entries/{entryId}')||
   !fragment.includes('accountOwner() && request.auth.uid == ownerUid'))
 throw Error('OWNER_PRICE_RULE_FRAGMENT_CHANGED');
const rule=`rules_version = '2';
service cloud.firestore {
 match /databases/{database}/documents {
 function accountOwner() {
  return request.auth != null && request.auth.uid == 'Iy5BWeZ17KW3Ost0m38LEhcjO9F3'
   && request.auth.token.email == 'honbin002@gmail.com'
   && request.auth.token.email_verified == true
   && request.auth.token.firebase.sign_in_provider == 'google.com';
 }
 ${fragment}
 }
}
`;
mkdirSync('.test-rules',{recursive:true});
writeFileSync('.test-rules/owner-supplier-price.rules',rule);
console.log('OWNER_PRICE_RULES_READY');
