'use strict';
// Offline authenticity preflight ONLY. Never proves provider quarantine or
// authorizes database recovery. Trust keys MUST be pinned out-of-band.
const crypto=require('node:crypto');
const {assessQuarantineEvidence,REQUIRED_CONTROLS} = require('./privacyRecoveryQuarantineEvidenceGate');
const DOMAIN='DEMOS_GDPR_QUARANTINE_EVIDENCE_V1\n';
const HEX=/^[0-9a-f]{64}$/;
const NAME=/^[a-zA-Z0-9_-]{8,100}$/;
const SIG=/^[A-Za-z0-9_-]{86}$/;
const SOURCES=Object.freeze([...new Set(Object.values(REQUIRED_CONTROLS))]);
const FIELDS=new Set(['verified','scope','recoveryId','sourceType','observedAt',
  'reference','evidenceSha256','attestorId','signature']);

function canonicalSignedEvidence(recoveryId,control,item){
  return Buffer.from(DOMAIN+JSON.stringify({
    version:1,recoveryId,control,verified:item.verified,scope:item.scope,
    sourceType:item.sourceType,observedAt:item.observedAt,
    reference:item.reference,evidenceSha256:item.evidenceSha256,
    attestorId:item.attestorId
  }),'utf8');
}
function noGo(basic,blockers,verifiedSignatures=0){
  return {decision:'NO_GO',blockers,checked:basic.checked,
    required:basic.required,verifiedSignatures};
}
function assessSignedQuarantineEvidence(payload,trustedRoots,options={}){
  const basic=assessQuarantineEvidence(payload,options);
  if(basic.decision==='NO_GO')return noGo(basic,basic.blockers);
  // No trust material may be sourced from the untrusted evidence envelope.
  if(!trustedRoots||typeof trustedRoots!=='object'||Array.isArray(trustedRoots))
    return noGo(basic,['MISSING_INDEPENDENT_TRUST_ROOTS']);
  if(Object.keys(trustedRoots).some(x=>!SOURCES.includes(x)))
    return noGo(basic,['UNKNOWN_TRUST_ROOT']);

  const knownKeys=new Map();
  const hashes=new Set();
  for(const type of SOURCES){
    if(!Object.prototype.hasOwnProperty.call(trustedRoots,type))
      return noGo(basic,['MISSING_TRUST_ROOT:'+type]);
    const root=trustedRoots[type];
    if(!root||typeof root!=='object'||Array.isArray(root)||
       !NAME.test(root.attestorId||'')||
       typeof root.publicKeyPem!=='string'||!HEX.test(root.expectedSpkiSha256||''))
      return noGo(basic,['INVALID_TRUST_ROOT:'+type]);
    try{
      const key=crypto.createPublicKey(root.publicKeyPem);
      if(key.asymmetricKeyType!=='ed25519')
        return noGo(basic,['INVALID_TRUST_ALGORITHM:'+type]);
      const hash=crypto.createHash('sha256')
        .update(key.export({type:'spki',format:'der'})).digest('hex');
      if(hash!==root.expectedSpkiSha256)
        return noGo(basic,['UNPINNED_TRUST_KEY:'+type]);
      if(hashes.has(hash))
        return noGo(basic,['REUSED_TRUST_KEY:'+type]);
      hashes.add(hash);
      knownKeys.set(type,{key,attestorId:root.attestorId});
    }catch(_){return noGo(basic,['INVALID_TRUST_KEY:'+type]);}
  }
  const blockers=[];let verifiedSignatures=0;
  for(const [control,sourceType] of Object.entries(REQUIRED_CONTROLS)){
    const item=payload.controls[control],root=knownKeys.get(sourceType);
    if(Object.keys(item).some(x=>!FIELDS.has(x))||
       typeof item.evidenceSha256!=='string'||!HEX.test(item.evidenceSha256)||
       item.attestorId!==root.attestorId||
       typeof item.signature!=='string'||!SIG.test(item.signature)){
      blockers.push('UNSIGNED_OR_INVALID_ATTESTATION:'+control);continue;
    }
    const signature=Buffer.from(item.signature,'base64url');
    if(signature.length!==64||signature.toString('base64url')!==item.signature||
       !crypto.verify(null,canonicalSignedEvidence(payload.recoveryId,control,item),
         root.key,signature)){
      blockers.push('INVALID_SIGNATURE:'+control);continue;
    }
    verifiedSignatures++;
  }
  if(blockers.length)return noGo(basic,blockers,verifiedSignatures);
  // Even a genuine Ed25519 signature cannot prove the claimed real-world fact.
  return {decision:'MANUAL_INDEPENDENT_REVIEW_REQUIRED',blockers:[],
    checked:basic.checked,required:basic.required,verifiedSignatures};
}
module.exports={assessSignedQuarantineEvidence,canonicalSignedEvidence};
