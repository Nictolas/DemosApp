'use strict';

// SYNTHETIC, TEST-ONLY PROTOCOL MODEL. No provider, SQL, network or app imports.
// This is not a production implementation and never grants a real release GO.
const crypto = require('node:crypto');

const ZERO = '0'.repeat(64);
const ACTIONS = new Set(['account_deleted', 'political_consent_revoked', 'political_consent_granted']);
const canonical = value => JSON.stringify(value);
const sha = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
const reject = code => { const e = new Error(code); e.code = code; throw e; };

function checkOperation(operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation) ||
      typeof operation.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(operation.id) ||
      typeof operation.subject !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(operation.subject) ||
      !ACTIONS.has(operation.action) ||
      Object.keys(operation).sort().join(',') !== 'action,id,subject') {
    reject('GDPR_MODEL_INVALID_OPERATION');
  }
  // Object key insertion order must not affect hash, equality or retries.
  return {id:operation.id,subject:operation.subject,action:operation.action};
}

// Independent witness model: stores the most recently acknowledged journal head.
// The private signing key and latest anchor intentionally live OUTSIDE the journal.
// This mocks a durable external witness; it is NOT an actual B2 attestation.
class SyntheticWitness {
  #secret;
  #latest = null;
  available = true;

  constructor(secret = 'synthetic-test-only') { this.#secret = secret; }
  attest(checkpoint) {
    if (!this.available) reject('GDPR_MODEL_WITNESS_UNAVAILABLE');
    const body = {epoch:checkpoint.epoch, count:checkpoint.count,
      head:checkpoint.head, sealed:checkpoint.sealed};
    const mac = crypto.createHmac('sha256', this.#secret)
      .update(canonical(body)).digest('hex');
    this.#latest = {...body, mac};
    return {...this.#latest};
  }
  current() { return this.#latest && {...this.#latest}; }
  verify(checkpoint) {
    if (!this.available) reject('GDPR_MODEL_WITNESS_UNAVAILABLE');
    if (!checkpoint || !this.#latest) reject('GDPR_MODEL_WITNESS_MISSING');
    const body = {epoch:checkpoint.epoch, count:checkpoint.count,
      head:checkpoint.head, sealed:checkpoint.sealed};
    const signed = crypto.createHmac('sha256', this.#secret)
      .update(canonical(body)).digest('hex');
    const a = Buffer.from(signed, 'hex');
    const b = Buffer.from(String(checkpoint.mac || ''), 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a,b) ||
        canonical(checkpoint) !== canonical(this.#latest)) {
      reject('GDPR_MODEL_WITNESS_MISMATCH');
    }
    return true;
  }
  // Simulate losing the independent anchor, not merely local SQL state.
  lose() { this.#latest = null; }
}

class SyntheticExternalJournal {
  constructor(witness = new SyntheticWitness(), epoch = 'synthetic-epoch-1') {
    this.witness = witness;
    this.epoch = epoch;
    this.entries = [];
    this.sealed = false;
    this.offline = false;
  }

  state() {
    return {epoch:this.epoch, count:this.entries.length,
      head:this.entries.at(-1)?.hash || ZERO, sealed:this.sealed};
  }
  append(phase, operation) {
    if (this.sealed) reject('GDPR_MODEL_JOURNAL_SEALED');
    if (this.offline) reject('GDPR_MODEL_EXTERNAL_UNAVAILABLE');
    const row = {seq:this.entries.length + 1,
      previous:this.entries.at(-1)?.hash || ZERO,
      epoch:this.epoch, phase, operation:{...operation}};
    const entry = {...row, hash:sha(row)};
    // Simulate a required witness being available before the append. This is
    // NOT an actual atomic two-provider commit protocol.
    if (!this.witness.available) reject('GDPR_MODEL_WITNESS_UNAVAILABLE');
    this.entries.push(entry);
    // Prototype assumes atomic, durable external append AND independent witness
    // acknowledgement. A real implementation must prove that property.
    this.witness.attest(this.state());
    return entry;
  }
  verify() {
    if (!this.sealed) reject('GDPR_MODEL_WRITERS_NOT_SEALED');
    let previous = ZERO;
    const pending = new Map();
    const pendingSubjects = new Map();
    const committed = [];
    const used = new Map();
    for (let i=0; i<this.entries.length; i++) {
      const e = this.entries[i];
      if (!e || e.seq !== i+1 || e.previous !== previous ||
          e.epoch !== this.epoch || e.hash !== sha({
            seq:e.seq, previous:e.previous, epoch:e.epoch,
            phase:e.phase, operation:e.operation
          })) reject('GDPR_MODEL_CHAIN_INVALID');
      const op = checkOperation(e.operation);
      const fingerprint = sha(op);
      const original = used.get(op.id);
      if (original && original !== fingerprint) reject('GDPR_MODEL_IDEMPOTENCY_CONFLICT');
      used.set(op.id, fingerprint);
      if (e.phase === 'prepare') {
        if (pending.has(op.id) || pendingSubjects.has(op.subject) ||
            committed.some(x=>x.id === op.id)) {
          reject('GDPR_MODEL_PENDING_OR_DUPLICATE');
        }
        pending.set(op.id, op);
        pendingSubjects.set(op.subject, op.id);
      } else if (e.phase === 'commit') {
        if (!pending.has(op.id) ||
            canonical(pending.get(op.id)) !== canonical(op)) {
          reject('GDPR_MODEL_COMMIT_WITHOUT_INTENT');
        }
        pending.delete(op.id);
        pendingSubjects.delete(op.subject);
        committed.push(op);
      } else reject('GDPR_MODEL_PHASE_INVALID');
      previous = e.hash;
    }
    this.witness.verify({...this.state(),mac:this.witness.current()?.mac});
    if (pending.size) reject('GDPR_MODEL_AMBIGUOUS_INTENT');
    return committed;
  }
  prior(operation) {
    // Normalize before comparing: object property insertion order must not
    // turn a legitimate retry into a false idempotency conflict.
    const normalized = checkOperation(operation);
    const id = normalized.id;
    const rows = this.entries.filter(e=>e.operation.id === id);
    if (!rows.length) return null;
    if (rows.some(e=>canonical(e.operation) !== canonical(normalized))) {
      reject('GDPR_MODEL_IDEMPOTENCY_CONFLICT');
    }
    if (rows.some(e=>e.phase === 'commit')) return 'committed';
    return 'pending';
  }
  prepare(operation) {
    const op=checkOperation(operation);
    const old=this.prior(op);
    if (old) return old;
    // Serialize only the SAME subject. Other subjects can prepare and commit
    // independently; journal sequence/hash and witnessed head remain global.
    if (this.entries.some(e => e.phase === 'prepare' &&
        e.operation.subject === op.subject &&
        !this.entries.some(f => f.phase === 'commit' && f.operation.id === e.operation.id))) {
      reject('GDPR_MODEL_AMBIGUOUS_INTENT');
    }
    this.append('prepare',op);
    return 'prepared';
  }
  commit(operation) {
    const op=checkOperation(operation);
    if (this.prior(op) !== 'pending') reject('GDPR_MODEL_COMMIT_WITHOUT_INTENT');
    this.append('commit',op);
  }
  // TEST-ONLY reconciliation. Simulates independently established proof from
  // the ORIGINAL live primary, not a restored snapshot, after every writer is
  // fenced. Never infer a commit from a user profile field alone.
  finalizeAmbiguousFromOriginalPrimary(originalDb,raw,{
    originalPrimaryVerified=false,writersFenced=false,independentWitness=null
  }={}) {
    const op=checkOperation(raw);
    if (this.sealed) reject('GDPR_MODEL_JOURNAL_SEALED');
    if (!originalPrimaryVerified || !writersFenced || !independentWitness) {
      reject('GDPR_MODEL_ORIGINAL_PRIMARY_NOT_ATTESTED');
    }
    this.witness.verify(independentWitness);
    if (this.prior(op) !== 'pending') reject('GDPR_MODEL_AMBIGUOUS_INTENT');
    if (!originalDb || !originalDb.hasExactCommit(op)) {
      reject('GDPR_MODEL_SQL_COMMIT_NOT_ATTESTED');
    }
    this.commit(op);
    return {externallyFinalized:true,productionRecoveryReady:false};
  }
  seal() {
    if (this.offline) reject('GDPR_MODEL_EXTERNAL_UNAVAILABLE');
    this.sealed=true;
    return this.witness.attest(this.state());
  }
}

class SyntheticDatabase {
  constructor(accounts = {}) {
    this.accounts = structuredClone(accounts);
    this.applied = new Map();
  }
  snapshot() {
    const result = new SyntheticDatabase(this.accounts);
    result.applied = new Map(this.applied);
    return result;
  }
  hasExactCommit(operation) {
    const op=checkOperation(operation);
    return this.applied.get(op.id) === sha(op);
  }
  apply(operation) {
    const op=checkOperation(operation);
    if (this.applied.has(op.id)) {
      if (!this.hasExactCommit(op)) reject('GDPR_MODEL_IDEMPOTENCY_CONFLICT');
      return 'already-applied';
    }
    const user=this.accounts[op.subject];
    if (!user) reject('GDPR_MODEL_UNKNOWN_SUBJECT');
    const next={...user};
    if (op.action === 'account_deleted') {
      next.exists=false;
      next.consent=false;
    } else {
      if (!next.exists) reject('GDPR_MODEL_ACCOUNT_DELETED');
      next.consent=op.action === 'political_consent_granted';
    }
    // In the synthetic model, state change and idempotency record are atomic.
    this.accounts[op.subject]=next;
    this.applied.set(op.id, sha(op));
    return 'applied';
  }
}

function submitSyntheticOperation(db,journal,raw,{crashAt=null}={}) {
  const op=checkOperation(raw);
  if (journal.sealed) reject('GDPR_MODEL_JOURNAL_SEALED');
  if (journal.prior(op) === 'committed') {
    // Reuse an already externally committed receipt; no duplicate SQL write.
    if (!db.applied.has(op.id)) reject('GDPR_MODEL_DB_JOURNAL_DIVERGENCE');
    return {confirmed:true,reused:true};
  }
  // Unknown precommit outcome is never automatically acknowledged or retried.
  if (journal.prior(op) === 'pending') reject('GDPR_MODEL_AMBIGUOUS_INTENT');
  if (crashAt === 'before_prepare') reject('GDPR_MODEL_SIMULATED_CRASH');
  journal.prepare(op);
  if (crashAt === 'after_prepare') reject('GDPR_MODEL_SIMULATED_CRASH');
  db.apply(op);
  if (crashAt === 'after_db_commit') reject('GDPR_MODEL_SIMULATED_CRASH');
  journal.commit(op);
  if (crashAt === 'after_external_commit') reject('GDPR_MODEL_SIMULATED_CRASH');
  return {confirmed:true,reused:false};
}

function restoreSyntheticSnapshot(snapshot,journal,{
  writersFenced=false, ingressBlocked=false, providersQuarantined=false,
  independentWitness=null
}={}) {
  // These flags are synthetic assertions, NOT real network attestations.
  if (!writersFenced || !ingressBlocked || !providersQuarantined) {
    reject('GDPR_MODEL_QUARANTINE_NOT_ATTESTED');
  }
  if (!independentWitness) reject('GDPR_MODEL_WITNESS_MISSING');
  journal.witness.verify(independentWitness);
  const operations=journal.verify();
  const restored=snapshot.snapshot();
  for (const op of operations) restored.apply(op);
  // Explicitly NEVER return a production recoveryReady or GO boolean.
  return {syntheticAdmission:true, productionRecoveryReady:false,
    replayed:operations.length, database:restored};
}

module.exports = {SyntheticWitness,SyntheticExternalJournal,SyntheticDatabase,
  submitSyntheticOperation,restoreSyntheticSnapshot};
