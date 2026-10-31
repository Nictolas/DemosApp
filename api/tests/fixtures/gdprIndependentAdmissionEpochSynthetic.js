'use strict';

// TEST ONLY: an independent authority held outside the PostgreSQL snapshot.
// It does NOT connect to B2, Render or Supabase, and cannot grant production GO.
const crypto = require('node:crypto');
function fail(code) { const e=new Error(code); e.code=code; throw e; }
const ID=/^[a-zA-Z0-9_-]{1,80}$/;
const HASH=/^[a-f0-9]{64}$/;
const canonical=v=>JSON.stringify(v);
const clone=v=>structuredClone(v);

class SyntheticIndependentAdmissionAuthority {
  #key;
  #state=null;
  #available=true;

  constructor(secret='synthetic-external-authority-test-only') {
    if(typeof secret!=='string' || !secret.length) fail('GDPR_EPOCH_BAD_KEY');
    this.#key=Buffer.from(secret);
  }
  setAvailable(available) { this.#available=available === true; }
  #requireAvailable() {
    if(!this.#available) fail('GDPR_EPOCH_AUTHORITY_UNAVAILABLE');
  }
  #sign(body) {
    return crypto.createHmac('sha256',this.#key)
      .update(canonical(body)).digest('hex');
  }
  #receipt() {
    const body=clone(this.#state);
    return {...body,mac:this.#sign(body)};
  }
  bootstrap({databaseId,checkpointHead}) {
    this.#requireAvailable();
    if(this.#state || !ID.test(databaseId||'') || !HASH.test(checkpointHead||''))
      fail('GDPR_EPOCH_BOOTSTRAP_DENIED');
    this.#state={databaseId,epoch:1,serial:1,phase:'open',checkpointHead};
    return this.#receipt();
  }
  current() {
    this.#requireAvailable();
    if(!this.#state) fail('GDPR_EPOCH_UNINITIALIZED');
    return this.#receipt();
  }
  #validateCurrent(receipt) {
    this.#requireAvailable();
    if(!this.#state || !receipt || typeof receipt!=='object' ||
      Array.isArray(receipt)) fail('GDPR_EPOCH_RECEIPT_MISSING');
    const {mac,...body}=receipt;
    const expected=this.#sign(body);
    const candidate=typeof mac==='string' && HASH.test(mac)
      ? Buffer.from(mac,'hex') : Buffer.alloc(0);
    const expectedBytes=Buffer.from(expected,'hex');
    if(candidate.length!==expectedBytes.length ||
      !crypto.timingSafeEqual(candidate,expectedBytes) ||
      canonical(body)!==canonical(this.#state)) {
      fail('GDPR_EPOCH_STALE_OR_FORGED');
    }
    return body;
  }
  // This is merely an admission simulation; it never authorizes a raw SQL
  // connection. Production must deny data-plane access *before* SQL.
  assertAdmission({receipt,localDatabaseId,localEpoch,localOpen,operation}) {
    const external=this.#validateCurrent(receipt);
    if(!['read','write'].includes(operation)) fail('GDPR_EPOCH_INVALID_OPERATION');
    if(external.phase!=='open' || localOpen!==true ||
       !ID.test(localDatabaseId||'') ||
       localDatabaseId!==external.databaseId ||
       !Number.isSafeInteger(localEpoch) ||
       localEpoch!==external.epoch) {
      fail('GDPR_EPOCH_ADMISSION_BLOCKED');
    }
    return {syntheticAdmission:true,productionRecoveryReady:false,
      epoch:external.epoch};
  }
  // Independent suspension advances epoch even if the restored SQL snapshot
  // rolls back its local epoch/gate to an earlier "open" state.
  suspend(receipt) {
    const before=this.#validateCurrent(receipt);
    if(before.phase!=='open') fail('GDPR_EPOCH_ALREADY_SUSPENDED');
    this.#state={...before,epoch:before.epoch+1,
      serial:before.serial+1,phase:'blocked'};
    return this.#receipt();
  }
  // Deliberately REQUIRE all external proofs, including a different DB
  // generation. The booleans here are fakes, never an actual qualification.
  admitRestoredGeneration({
    receipt,newDatabaseId,newCheckpointHead,
    writersFenced=false,ingressBlocked=false,providersQuarantined=false,
    journalComplete=false,replayVerified=false
  }) {
    const before=this.#validateCurrent(receipt);
    if(before.phase!=='blocked' || !ID.test(newDatabaseId||'') ||
       newDatabaseId===before.databaseId || !HASH.test(newCheckpointHead||'') ||
       !writersFenced || !ingressBlocked || !providersQuarantined ||
       !journalComplete || !replayVerified) {
      fail('GDPR_EPOCH_RECOVERY_EVIDENCE_MISSING');
    }
    this.#state={databaseId:newDatabaseId,epoch:before.epoch+1,
      serial:before.serial+1,phase:'open',checkpointHead:newCheckpointHead};
    return this.#receipt();
  }
}
module.exports={SyntheticIndependentAdmissionAuthority};
