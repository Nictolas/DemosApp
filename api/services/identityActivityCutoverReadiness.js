const {isIdentityActivitySchemaReady}=require('./identityActivityShadowReadiness');
const {checkIdentityActivityParity}=require('./identityActivityParityPolicy');
let backfillAttested=false;
const attestBackfillForProcess=()=>{backfillAttested=true;};
const resetCutoverReadinessForTests=()=>{backfillAttested=false;};
const evaluateIdentityActivityCutoverReadiness=async(client)=>{
  const schemaReady=isIdentityActivitySchemaReady();
  if(!schemaReady)return{ready:false,schemaReady:false,backfillReady:false,parityReady:false};
  if(!backfillAttested)return{ready:false,schemaReady:true,backfillReady:false,parityReady:false};
  const parity=await checkIdentityActivityParity(client);
  return{ready:parity.ready===true,schemaReady:true,backfillReady:true,parityReady:parity.ready===true,missingAccounts:parity.missingAccounts,laggingAccounts:parity.laggingAccounts};
};
module.exports={attestBackfillForProcess,evaluateIdentityActivityCutoverReadiness,resetCutoverReadinessForTests};
