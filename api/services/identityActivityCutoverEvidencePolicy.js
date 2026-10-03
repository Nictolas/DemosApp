const {verifyMigrationEvidence}=require('./identityLifecycleMigrationEvidence');
const MAX_EVIDENCE_AGE_MS=15*60*1000;
const validateCutoverEvidence=({evidence,evidenceDigest,now=new Date()})=>{
 if(!evidence||typeof evidence!=='object'||!evidenceDigest)return{valid:false,reason:'EVIDENCE_REQUIRED'};
 if(!verifyMigrationEvidence(evidence,evidenceDigest))return{valid:false,reason:'EVIDENCE_INTEGRITY_FAILED'};
 const observed=new Date(evidence.observedAt),current=new Date(now);
 if(!Number.isFinite(observed.getTime())||!Number.isFinite(current.getTime())||observed>current||current-observed>MAX_EVIDENCE_AGE_MS)return{valid:false,reason:'EVIDENCE_STALE'};
 if(evidence.schemaReady!==true||evidence.backfillReady!==true||Number(evidence.missingAccounts)!==0||Number(evidence.laggingAccounts)!==0)return{valid:false,reason:'EVIDENCE_NOT_READY'};
 return{valid:true};
};
module.exports={MAX_EVIDENCE_AGE_MS,validateCutoverEvidence};
