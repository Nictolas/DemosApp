const {evaluateIdentityActivityCutoverReadiness}=require('./identityActivityCutoverReadiness');
const authorizeIdentityActivityCutover=async(client,{manualApprovalRecorded=false}={})=>{
  if(manualApprovalRecorded!==true)return{authorized:false,reason:'MANUAL_APPROVAL_REQUIRED'};
  const readiness=await evaluateIdentityActivityCutoverReadiness(client);
  if(!readiness.ready)return{authorized:false,reason:'READINESS_INCOMPLETE',readiness};
  return{authorized:true,readiness};
};
module.exports={authorizeIdentityActivityCutover};
