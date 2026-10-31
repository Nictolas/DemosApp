'use strict';

// CI-ONLY in-memory model of a drain-before-freeze handshake. No B2, SQL,
// Render, Supabase, network, real keys or credentials. Do NOT import in app.
// A lease is NOT a real distributed lock and cannot stop bypassed SQL writers.
const {SyntheticIndependentAdmissionAuthority}=
  require('./gdprIndependentAdmissionEpochSynthetic');

const err=code=>{const e=new Error(code);e.code=code;throw e;};

class SyntheticCommitAdmissionLeaseGate {
  #authority;
  #state='open';
  #active=new Set();
  #waiters=[];
  constructor(authority) {
    if(!(authority instanceof SyntheticIndependentAdmissionAuthority))
      err('GDPR_LEASE_BAD_AUTHORITY');
    this.#authority=authority;
  }
  get state() { return this.#state; }
  get activeCount() { return this.#active.size; }

  // The admission and registration happen in one synchronous turn of the
  // model. In real life this requires an external *enforced* lease service.
  begin({receipt,localDatabaseId,localEpoch,localOpen,operation='write'}) {
    if(this.#state!=='open') err('GDPR_LEASE_FREEZE_IN_PROGRESS');
    const admission=this.#authority.assertAdmission({
      receipt,localDatabaseId,localEpoch,localOpen,operation
    });
    const lease=Object.freeze({synthetic:true,productionRecoveryReady:false,
      token:Symbol('synthetic-opaque-lease'),epoch:admission.epoch});
    this.#active.add(lease);
    return lease;
  }

  // Must be invoked ONLY AFTER DB COMMIT/ROLLBACK returns. If invoked before
  // commit this model becomes unsafe (negative test demonstrates this).
  finish(lease) {
    if(!this.#active.delete(lease))err('GDPR_LEASE_UNKNOWN_OR_REUSED');
    if(this.#state==='closing' && this.#active.size===0){
      const resolvers=this.#waiters.splice(0);
      this.#state='blocked';
      for(const resolve of resolvers)resolve({
        syntheticFreezeAck:true,productionRecoveryReady:false
      });
    }
  }

  // Close admission synchronously; complete ack only after ALL leases finish.
  // No timer/automatic override: a crashed owner leaves freeze PENDING and
  // needs an independent provider data-plane cut-off and crash recovery.
  freeze() {
    if(this.#state==='blocked') return Promise.resolve({
      syntheticFreezeAck:true,productionRecoveryReady:false
    });
    this.#state='closing';
    if(this.#active.size===0){
      this.#state='blocked';
      return Promise.resolve({
        syntheticFreezeAck:true,productionRecoveryReady:false
      });
    }
    return new Promise(resolve=>this.#waiters.push(resolve));
  }
}

module.exports={SyntheticCommitAdmissionLeaseGate};
