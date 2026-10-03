const {isIdentityActivityShadowEnabled}=require('../config/identityActivityShadowPolicy');
const {mirrorLifecycleActivity}=require('./identityActivityDualWriteShadow');
const {recordActivityMirrorOutcome}=require('./identityActivityShadowTelemetry');
const shadowRecordAccountActivity=async({client,accountId,at=new Date()})=>{
  if(!isIdentityActivityShadowEnabled())return{enabled:false,mirrored:false};
  const result=await mirrorLifecycleActivity({client,accountId,at});
  recordActivityMirrorOutcome(result);
  return{enabled:true,...result};
};
module.exports={shadowRecordAccountActivity};
