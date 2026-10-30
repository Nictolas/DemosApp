'use strict';

/**
 * RESEARCH ONLY. Candidate external restore-readiness contract for DEMOS.
 *
 * The RESTORE GATE and durable erasure ledger MUST live outside the database
 * being restored. This guard deliberately accepts no state read from SQL and
 * requires an independent verifier callback. The callback is an injected
 * contract, NOT a supplied verifier implementation or proof of B2 durability.
 *
 * Any HTTP endpoint relying on this check must be blocked at ingress while
 * restore/attestation changes, including old Android API paths, public
 * aggregates, personal exports, notifications, background jobs and writes.
 * A request-time check alone does not close in-flight race windows.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/i;
const VERSION=/^[a-zA-Z0-9_.:-]{1,128}$/;
function fail(reason){
  const error=new Error('GDPR_EXTERNAL_RESTORE_NOT_READY');
  error.code='RESTORE_NOT_READY';
  error.reason=reason;
  return error;
}
function time(value){
  if(typeof value!=='string'||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)){
    throw fail('timestamp');
  }
  const n=Date.parse(value);
  if(!Number.isFinite(n))throw fail('timestamp');
  return n;
}
function createHybridExternalRestoreGate({
  getExternalAttestation,verifyExternalAttestation,
  expectedRestoreGeneration,expectedSnapshotId,now=()=>Date.now()
}={}){
  if(typeof getExternalAttestation!=='function'||
    typeof verifyExternalAttestation!=='function'||
    typeof now!=='function'||
    typeof expectedRestoreGeneration!=='string'||
    !UUID.test(expectedRestoreGeneration)||
    typeof expectedSnapshotId!=='string'||
    !VERSION.test(expectedSnapshotId)){
    throw new TypeError('External restore verifier and pinned restore identity required');
  }
  return async function assertRestoreReady(){
    let a;
    try{
      // Never fetch readiness from a table in the restored Supabase DB.
      a=await getExternalAttestation();
    }catch(_error){
      throw fail('external-attestation-unavailable');
    }
    if(!a||typeof a!=='object'||Array.isArray(a)||
      a.restore_generation!==expectedRestoreGeneration||
      a.snapshot_id!==expectedSnapshotId||
      a.restore_status!=='ready'||
      a.ledger_complete!==true||
      a.replay_committed!==true||
      a.ingress_restore_barrier!=='externally_enforced'||
      typeof a.external_ledger_digest!=='string'||
      !HASH.test(a.external_ledger_digest)){
      throw fail('incomplete-or-wrong-generation');
    }
    const snapshot=time(a.snapshot_at);
    const start=time(a.ledger_covers_from);
    const end=time(a.ledger_covers_through);
    const cutover=time(a.replay_scope_through);
    const replayed=time(a.replay_completed_at);
    const issued=time(a.issued_at);
    const expires=time(a.expires_at);
    const current=now();
    // Fail closed on stale or future-dated proof, gaps in replay window,
    // expired leases or a proof whose TTL exceeds one minute.
    if(!Number.isFinite(current)||start>snapshot||end<cutover||
      snapshot>cutover||replayed<cutover||issued<replayed||
      issued>current||expires<=current||expires<=issued||
      expires-issued>60_000||current-issued>60_000){
      throw fail('invalid-coverage-or-expired-attestation');
    }
    let verified;
    try{
      // Only the externally trusted coordinator can validate this proof.
      verified=await verifyExternalAttestation(a);
    }catch(_error){
      throw fail('proof-verification-unavailable');
    }
    if(verified!==true){
      throw fail('unverified-external-proof');
    }
    return true;
  };
}

module.exports={createHybridExternalRestoreGate};
