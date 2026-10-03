const {evaluateIdentityActivityCutoverReadiness}=require('./identityActivityCutoverReadiness');
const {validateCutoverEvidence}=require('./identityActivityCutoverEvidencePolicy');
const authorizeIdentityActivityCutover=async(client,{evidence,evidenceDigest,approval,approvalSignature,approvalVerifier,replayStore,now=new Date()}={})=>{
 const evidenceCheck=validateCutoverEvidence({evidence,evidenceDigest,now});if(!evidenceCheck.valid)return{authorized:false,reason:evidenceCheck.reason};
 if(!approvalVerifier||typeof approvalVerifier.verify!=='function')return{authorized:false,reason:'APPROVAL_VERIFIER_REQUIRED'};
 const approvalCheck=await approvalVerifier.verify({approval,signature:approvalSignature,expectedMigrationVersion:evidence.migrationVersion,expectedEvidenceDigest:evidenceDigest,now});
 if(!approvalCheck||approvalCheck.valid!==true)return{authorized:false,reason:approvalCheck?.reason||'APPROVAL_PROOF_INVALID'};
 const readiness=await evaluateIdentityActivityCutoverReadiness(client);if(!readiness.ready)return{authorized:false,reason:'READINESS_INCOMPLETE',readiness};
 if(!replayStore||typeof replayStore.consumeOnce!=='function')return{authorized:false,reason:'APPROVAL_REPLAY_STORE_REQUIRED'};
 const consumed=await replayStore.consumeOnce(approval.nonce);if(consumed!==true)return{authorized:false,reason:'APPROVAL_REPLAYED'};
 return{authorized:true,readiness};
};
module.exports={authorizeIdentityActivityCutover};
