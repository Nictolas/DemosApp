const {canonicalApproval}=require('./identityActivityCutoverApprovalProof');
const APPROVAL_DOMAIN='demos:identity-activity-cutover-approval:v1\0';
const createKmsApprovalVerifier=({verifyDigest,keyId})=>{
 if(typeof verifyDigest!=='function')throw new Error('KMS verify operation required');
 if(typeof keyId!=='string'||keyId.length<1)throw new Error('KMS key identifier required');
 return Object.freeze({verify:async({approval,signature,expectedMigrationVersion,expectedEvidenceDigest,now=new Date()})=>{
  try{
   if(!approval||!signature)return{valid:false,reason:'APPROVAL_PROOF_REQUIRED'};
   if(String(approval.migrationVersion)!==String(expectedMigrationVersion)||String(approval.evidenceDigest).toLowerCase()!==String(expectedEvidenceDigest).toLowerCase())return{valid:false,reason:'APPROVAL_BINDING_MISMATCH'};
   const at=new Date(approval.approvedAt),current=new Date(now);if(!Number.isFinite(at.getTime())||!Number.isFinite(current.getTime())||at>current||current-at>15*60*1000)return{valid:false,reason:'APPROVAL_STALE'};
   if(typeof approval.nonce!=='string'||approval.nonce.length<16)return{valid:false,reason:'APPROVAL_NONCE_INVALID'};
   const crypto=require('crypto');const digest=crypto.createHash('sha256').update(APPROVAL_DOMAIN+canonicalApproval(approval),'utf8').digest();
   const ok=await verifyDigest({keyId,digest,signature:String(signature)});
   return ok===true?{valid:true}:{valid:false,reason:'APPROVAL_SIGNATURE_INVALID'};
  }catch(_error){return{valid:false,reason:'APPROVAL_VERIFICATION_FAILED'}}
 }});
};
module.exports={APPROVAL_DOMAIN,createKmsApprovalVerifier};
