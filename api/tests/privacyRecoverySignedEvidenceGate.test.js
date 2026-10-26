'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {REQUIRED_CONTROLS}=require('../services/privacyRecoveryQuarantineEvidenceGate');
const {assessSignedQuarantineEvidence,canonicalSignedEvidence}=
  require('../services/privacyRecoverySignedEvidenceGate');
const NOW=new Date('2026-10-26T22:00:00.000Z');
const ID='synthetic_recovery_20261026';
function fixture(){
 const roots={},privateKeys={},payload={recoveryId:ID,controls:{}};
 for(const type of new Set(Object.values(REQUIRED_CONTROLS))){
   const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
   roots[type]={
     publicKeyPem:publicKey.export({type:'spki',format:'pem'}),
     expectedSpkiSha256:crypto.createHash('sha256')
       .update(publicKey.export({type:'spki',format:'der'})).digest('hex'),
     attestorId:'attestor_'+type
   };
   privateKeys[type]=privateKey;
 }
 for(const [control,sourceType] of Object.entries(REQUIRED_CONTROLS)){
   const item={
     verified:true,scope:'production',recoveryId:ID,sourceType,
     observedAt:control==='independentLedgerFreshness'?'2026-10-26T21:57:00.000Z':
       control==='b2ImmutableVersionReadback'?'2026-10-26T21:58:00.000Z':
       control==='controllerAndDpoApproval'?'2026-10-26T21:59:00.000Z':
       '2026-10-26T21:56:00.000Z',
     reference:'synthetic-ref-'+control,
     evidenceSha256:crypto.createHash('sha256').update('synthetic:'+control).digest('hex'),
     attestorId:roots[sourceType].attestorId
   };
   item.signature=crypto.sign(null,canonicalSignedEvidence(ID,control,item),
     privateKeys[sourceType]).toString('base64url');
   payload.controls[control]=item;
 }
 return {payload,roots,privateKeys};
}
function evaluate(f){return assessSignedQuarantineEvidence(f.payload,f.roots,{now:NOW});}
test('15 pinned and independently signed proofs still require manual review',()=>{
 const r=evaluate(fixture());
 assert.equal(r.decision,'MANUAL_INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(r.verifiedSignatures,15);
 assert.equal(r.checked,15);
 assert.deepEqual(r.blockers,[]);
 assert.equal(JSON.stringify(r).includes('synthetic-ref'),false);
});
test('unsigned claims or keyrings supplied inside the packet cannot pass',()=>{
 const f=fixture();
 for(const item of Object.values(f.payload.controls))delete item.signature;
 assert.equal(evaluate(f).decision,'NO_GO');
 assert.equal(evaluate(f).verifiedSignatures,0);
 const g=fixture();g.payload.trustedRoots=g.roots;
 assert.deepEqual(assessSignedQuarantineEvidence(g.payload,null,{now:NOW}).blockers,
   ['MISSING_INDEPENDENT_TRUST_ROOTS']);
});
test('changed dates and evidence digests invalidate their detached signatures',()=>{
 const f=fixture();
 f.payload.controls.supabaseDatabaseProbe.observedAt='2026-10-26T21:56:30.000Z';
 assert.deepEqual(evaluate(f).blockers,['INVALID_SIGNATURE:supabaseDatabaseProbe']);
 const g=fixture();g.payload.controls.renderWorkersStopped.evidenceSha256='0'.repeat(64);
 assert.deepEqual(evaluate(g).blockers,['INVALID_SIGNATURE:renderWorkersStopped']);
});
test('a valid signature cannot be replayed for a different control',()=>{
 const f=fixture();
 f.payload.controls.supabaseDatabaseProbe.signature=
   f.payload.controls.supabaseDataApiProbe.signature;
 assert.deepEqual(evaluate(f).blockers,['INVALID_SIGNATURE:supabaseDatabaseProbe']);
});
test('wrong signer, unapproved key substitution and algorithm cannot pass',()=>{
 const f=fixture();f.payload.controls.supabaseDataApiDisabled.attestorId='spoofed_signer';
 assert.deepEqual(evaluate(f).blockers,
   ['UNSIGNED_OR_INVALID_ATTESTATION:supabaseDataApiDisabled']);
 const g=fixture();g.roots.supabase_dashboard.publicKeyPem=
   crypto.generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
 assert.deepEqual(evaluate(g).blockers,['UNPINNED_TRUST_KEY:supabase_dashboard']);
 const h=fixture();const rsa=crypto.generateKeyPairSync('rsa',{modulusLength:2048}).publicKey;
 h.roots.supabase_dashboard.publicKeyPem=rsa.export({type:'spki',format:'pem'});
 h.roots.supabase_dashboard.expectedSpkiSha256=crypto.createHash('sha256')
   .update(rsa.export({type:'spki',format:'der'})).digest('hex');
 assert.deepEqual(evaluate(h).blockers,['INVALID_TRUST_ALGORITHM:supabase_dashboard']);
});
test('same signing key cannot assert independent provider and probe roots',()=>{
 const f=fixture();
 f.roots.supabase_dashboard={...f.roots.render_dashboard,attestorId:'different_operator'};
 assert.deepEqual(evaluate(f).blockers,['REUSED_TRUST_KEY:supabase_dashboard']);
});
test('unsigned extra fields, malformed signature, stale proof and incorrect chronology fail',()=>{
 const f=fixture();f.payload.controls.renderIngressIsolation.override='GO';
 assert.deepEqual(evaluate(f).blockers,
   ['UNSIGNED_OR_INVALID_ATTESTATION:renderIngressIsolation']);
 const g=fixture();g.payload.controls.supabaseDatabaseProbe.signature='bad';
 assert.deepEqual(evaluate(g).blockers,
   ['UNSIGNED_OR_INVALID_ATTESTATION:supabaseDatabaseProbe']);
 const h=fixture();h.payload.controls.supabaseDatabaseProbe.observedAt='2026-10-26T21:00:00.000Z';
 assert.equal(evaluate(h).decision,'NO_GO');
 const k=fixture();k.payload.controls.independentLedgerFreshness.observedAt=
   '2026-10-26T21:55:00.000Z';
 k.payload.controls.independentLedgerFreshness.signature=crypto.sign(null,
   canonicalSignedEvidence(ID,'independentLedgerFreshness',
   k.payload.controls.independentLedgerFreshness),
   k.privateKeys.independent_ledger_pin).toString('base64url');
 assert.deepEqual(evaluate(k).blockers,['OUT_OF_ORDER:independentLedgerFreshness']);
});
test('failing verdicts never disclose credentials, attestors, or submitted evidence',()=>{
 const f=fixture();f.roots.unsupported={privateKey:'injected-secret-key'};
 const r=evaluate(f);
 assert.deepEqual(r.blockers,['UNKNOWN_TRUST_ROOT']);
 assert.equal(JSON.stringify(r).includes('injected-secret-key'),false);
});
