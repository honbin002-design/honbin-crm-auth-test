// Pure public-only release switch. Never contains secrets or private account info.
// The GitHub sender also separately requires its protected VAPID credentials.
export function confirmedLivePublicPushConfig(config,expectedKey){
 return !!config&&typeof config==='object'&&
  config.schemaVersion===1&&config.subscriptionsEnabled===true&&
  config.senderEnabled===true&&config.environment==='SPARK_LIVE_FREE'&&
  typeof expectedKey==='string'&&/^[A-Za-z0-9_-]{87}$/.test(expectedKey)&&
  config.publicVapidKey===expectedKey;
}
