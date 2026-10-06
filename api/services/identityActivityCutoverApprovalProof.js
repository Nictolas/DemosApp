const crypto=require('crypto');
const MAX_APPROVAL_AGE_MS=15*60*1000;
const canonicalApproval=({migrationVersion,evidenceDigest,approvedAt,nonce})=>JSON.stringify({migrationVersion:String(migrationVersion),evidenceDigest:String(evidenceDigest).toLowerCase(),approvedAt:new Date(approvedAt).toISOString(),nonce:String(nonce)});
const signCutoverApproval=({approval,key})=>{if(!Buffer.isBuffer(key)||key.length!==32)throw new Error('Cutover approval key required');return crypto.createHmac('sha256',key).update('demos:identity-activity-cutover-approval:v1\0'+canonicalApproval(approval),'utf8').digest('hex')};
const verifyCutoverApproval=({approval,signature,key,expectedMigrationVersion,expectedEvidenceDigest,now=new Date()})=>{
 try{
  if(!approval||!signature||!Buffer.isBuffer(key)||key.length!==32)return{valid:false,reason:'APPROVAL_PROOF_REQUIRED'};
  if(String(approval.migrationVersion)!==String(expectedMigrationVersion)||String(approval.evidenceDigest).toLowerCase()!==String(expectedEvidenceDigest).toLowerCase())return{valid:false,reason:'APPROVAL_BINDING_MISMATCH'};
  const at=new Date(approval.approvedAt),current=new Date(now);if(!Number.isFinite(at.getTime())||!Number.isFinite(current.getTime())||at>current||current-at>MAX_APPROVAL_AGE_MS)return{valid:false,reason:'APPROVAL_STALE'};
  if(typeof approval.nonce!=='string'||approval.nonce.length<16)return{valid:false,reason:'APPROVAL_NONCE_INVALID'};
  const expected=Buffer.from(signCutoverApproval({approval,key}),'hex'),got=Buffer.from(String(signature),'hex');if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return{valid:false,reason:'APPROVAL_SIGNATURE_INVALID'};
  return{valid:true};
 }catch(_error){return{valid:false,reason:'APPROVAL_PROOF_INVALID'}}
};
module.exports={MAX_APPROVAL_AGE_MS,canonicalApproval,signCutoverApproval,verifyCutoverApproval};
