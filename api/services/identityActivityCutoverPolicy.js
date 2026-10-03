const {evaluateIdentityActivityCutoverReadiness}=require('./identityActivityCutoverReadiness');
const {validateCutoverEvidence}=require('./identityActivityCutoverEvidencePolicy');
const authorizeIdentityActivityCutover=async(client,{manualApprovalRecorded=false,evidence,evidenceDigest,now=new Date()}={})=>{
  if(manualApprovalRecorded!==true)return{authorized:false,reason:'MANUAL_APPROVAL_REQUIRED'};
  const evidenceCheck=validateCutoverEvidence({evidence,evidenceDigest,now});
  if(!evidenceCheck.valid)return{authorized:false,reason:evidenceCheck.reason};
  const readiness=await evaluateIdentityActivityCutoverReadiness(client);
  if(!readiness.ready)return{authorized:false,reason:'READINESS_INCOMPLETE',readiness};
  return{authorized:true,readiness};
};
module.exports={authorizeIdentityActivityCutover};
