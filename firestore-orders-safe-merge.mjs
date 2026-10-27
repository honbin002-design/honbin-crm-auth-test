// Pure offline insertion; never reads or publishes Firebase Rules.
export function mergeOrdersRules(current, fragment) {
  if(typeof current!=='string'||!current.startsWith("rules_version = '2';")||
    current.length<1000||current.includes('__OWNER_UID__'))throw Error('CURRENT_RULES_REQUIRED');
  const anchor='      // BEGIN TEST TASK ACL EXTENSION (REVIEWED SEPARATELY)';
  if(current.split(anchor).length!==2||current.includes('match /orders/'))
    throw Error('RULES_ANCHOR_MISSING_OR_ORDERS_ALREADY_PRESENT');
  for(const part of ['function googleUser()', 'function canViewGroup(groupId)',
    "data.status == 'ACTIVE'", 'match /approvedAccounts/', 'match /pushSubscriptions/',
    'match /ownerSupplierPrices/'])if(!current.includes(part))throw Error('BASELINE_INCOMPLETE');
  if(!fragment.includes('match /orders/{orderId}')||!fragment.includes('auditMatches(')||
    !fragment.includes('allow delete: if false;'))throw Error('ORDERS_FRAGMENT_INVALID');
  const inserted='      // BEGIN ORDERS V1 ADDITIVE EXTENSION\n'+fragment+
    '\n      // END ORDERS V1 ADDITIVE EXTENSION\n';
  const merged=current.replace(anchor,()=>inserted+anchor);
  if(merged.replace(inserted,'')!==current)throw Error('EXISTING_RULES_CHANGED');
  return {merged,exactOriginalPreserved:true};
}
