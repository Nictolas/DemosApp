const {evaluateIdentityActivityCutoverReadiness}=require('./identityActivityCutoverReadiness');
const {validateCutoverEvidence}=require('./identityActivityCutoverEvidencePolicy');
const {verifyCutoverApproval}=require('./identityActivityCutoverApprovalProof');
const authorizeIdentityActivityCutover=async(client,{evidence,evidenceDigest,approval,approvalSignature,approvalKey,now=new Date()}={})=>{
  const evidenceCheck=validateCutoverEvidence({evidence,evidenceDigest,now});
  if(!evidenceCheck.valid)return{authorized:false,reason:evidenceCheck.reason};
  const approvalCheck=verifyCutoverApproval({approval,signature:approvalSignature,key:approvalKey,expectedMigrationVersion:evidence.migrationVersion,expectedEvidenceDigest:evidenceDigest,now});
  if(!approvalCheck.valid)return{authorized:false,reason:approvalCheck.reason};
  const readiness=await evaluateIdentityActivityCutoverReadiness(client);
  if(!readiness.ready)return{authorized:false,reason:'READINESS_INCOMPLETE',readiness};
  return{authorized:true,readiness};
};
module.exports={authorizeIdentityActivityCutover};
