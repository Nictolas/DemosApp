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
  #lost = false;
  available = true;

  constructor(secret = 'synthetic-test-only') { this.#secret = secret; }
  attest(checkpoint, entry = null) {
    if (!this.available) reject('GDPR_MODEL_WITNESS_UNAVAILABLE');
    // A lost independent anchor must not be silently recreated by signing a
    // restored, possibly truncated journal. Require external recovery instead.
    if (this.#lost) reject('GDPR_MODEL_WITNESS_MISSING');
    if (!checkpoint || typeof checkpoint !== 'object')
      reject('GDPR_MODEL_WITNESS_INVALID_CHECKPOINT');
    const body = {epoch:checkpoint.epoch, count:checkpoint.count,
      head:checkpoint.head, sealed:checkpoint.sealed};
    if (typeof body.epoch !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(body.epoch) ||
        !Number.isSafeInteger(body.count) || body.count < 0 ||
        typeof body.head !== 'string' || !/^[a-f0-9]{64}$/.test(body.head) ||
        typeof body.sealed !== 'boolean')
      reject('GDPR_MODEL_WITNESS_INVALID_CHECKPOINT');
    const prior = this.#latest;
    if (!prior) {
      // Initial acknowledgement must be the first append or an empty seal.
      if (!((body.count === 1 && !body.sealed && body.head !== ZERO) ||
            (body.count === 0 && body.sealed && body.head === ZERO)))
        reject('GDPR_MODEL_WITNESS_NON_MONOTONIC');
    } else {
      const nextAppend = !prior.sealed && !body.sealed &&
        body.count === prior.count + 1 && body.head !== prior.head;
      const nextSeal = !prior.sealed && body.sealed &&
        body.count === prior.count && body.head === prior.head;
      const sealedRetry = prior.sealed && body.sealed &&
        body.count === prior.count && body.head === prior.head;
      if (body.epoch !== prior.epoch ||
          !(nextAppend || nextSeal || sealedRetry))
        reject('GDPR_MODEL_WITNESS_NON_MONOTONIC');
    }
    // A counter and an arbitrary 64-character hash do not constitute proof
    // of an append. Bind every new checkpoint to its exact synthetic record.
    // This is an IN-MEMORY fixture, not a remotely attested durable object.
    if (!body.sealed) {
      const priorHead = prior?.head || ZERO;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
          Object.keys(entry).sort().join(',') !==
            'epoch,hash,operation,phase,previous,seq' ||
          entry.seq !== body.count || entry.epoch !== body.epoch ||
          entry.previous !== priorHead || entry.hash !== body.head ||
          !['prepare','commit'].includes(entry.phase)) {
        reject('GDPR_MODEL_WITNESS_ENTRY_INVALID');
      }
      let normalized;
      try { normalized=checkOperation(entry.operation); }
      catch { reject('GDPR_MODEL_WITNESS_ENTRY_INVALID'); }
      if (canonical(entry.operation) !== canonical(normalized) ||
          sha({seq:entry.seq,previous:entry.previous,epoch:entry.epoch,
            phase:entry.phase,operation:normalized}) !== body.head) {
        reject('GDPR_MODEL_WITNESS_ENTRY_INVALID');
      }
    } else if (entry !== null) {
      reject('GDPR_MODEL_WITNESS_ENTRY_INVALID');
    }
    const mac = crypto.createHmac('sha256', this.#secret)
      .update(canonical(body)).digest('hex');
    this.#latest = {...body, mac};
    return {...this.#latest};
  }
  current() { return this.#latest && {...this.#latest}; }
  verify(checkpoint) {
    if (!this.available) reject('GDPR_MODEL_WITNESS_UNAVAILABLE');
    if (this.#lost || !checkpoint || !this.#latest)
      reject('GDPR_MODEL_WITNESS_MISSING');
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
  lose() { this.#lost = true; this.#latest = null; }
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
  append(phase, operation, {crashAfterWitness=false}={}) {
    if (this.sealed) reject('GDPR_MODEL_JOURNAL_SEALED');
    if (this.offline) reject('GDPR_MODEL_EXTERNAL_UNAVAILABLE');
    const row = {seq:this.entries.length + 1,
      previous:this.entries.at(-1)?.hash || ZERO,
      epoch:this.epoch, phase, operation:{...operation}};
    const entry = {...row, hash:sha(row)};
    // Simulate a required witness being available before the append. This is
    // NOT an actual atomic two-provider commit protocol.
    if (!this.witness.available) reject('GDPR_MODEL_WITNESS_UNAVAILABLE');
    // Do not append in-memory until the witness has checked the exact entry.
    // A real implementation still needs a durable atomic two-provider protocol.
    const checkpoint={epoch:this.epoch,count:entry.seq,head:entry.hash,sealed:false};
    this.witness.attest(checkpoint,entry);
    // An ACK can arrive before the journal entry is durably published.
    // Model that dangerous cross-provider gap without repairing it locally.
    if (crashAfterWitness) reject('GDPR_MODEL_SIMULATED_CRASH');
    this.entries.push(entry);
    return entry;
  }
  // Validate a live prefix without requiring all operations to have committed.
  // This also gates idempotent receipt reuse: a cached local row alone is not
  // proof that the current independent witness still attests the chain.
  validatePrefix({requireSealed=false,allowPending=true}={}) {
    if (requireSealed && !this.sealed)
      reject('GDPR_MODEL_WRITERS_NOT_SEALED');
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
    if (!allowPending && pending.size) reject('GDPR_MODEL_AMBIGUOUS_INTENT');
    return committed;
  }
  verify() {
    return this.validatePrefix({requireSealed:true,allowPending:false});
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
  prepare(operation, {crashAfterWitness=false}={}) {
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
    this.append('prepare',op,{crashAfterWitness});
    return 'prepared';
  }
  commit(operation, {crashAfterWitness=false}={}) {
    const op=checkOperation(operation);
    if (this.prior(op) !== 'pending') reject('GDPR_MODEL_COMMIT_WITHOUT_INTENT');
    this.append('commit',op,{crashAfterWitness});
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
  seal({crashAfterWitness=false}={}) {
    if (this.offline) reject('GDPR_MODEL_EXTERNAL_UNAVAILABLE');
    // Never mark even the synthetic journal sealed if attestation fails.
    const receipt=this.witness.attest({...this.state(),sealed:true});
    if (crashAfterWitness) reject('GDPR_MODEL_SIMULATED_CRASH');
    this.sealed=true;
    return receipt;
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

// A restored SQL snapshot must not contain a later same-subject commit marker
// while missing an earlier one. Replaying an earlier revoke and skipping an
// already-marked later grant would silently reverse the final consent state.
// Cross-subject SQL commits can interleave independently, so this is NOT a
// global journal-prefix requirement. Synthetic markers are not real SQL proof.
function validateSyntheticSnapshotLineage(snapshot, committed) {
  if (!(snapshot instanceof SyntheticDatabase) ||
      !(snapshot.applied instanceof Map) ||
      !snapshot.accounts || typeof snapshot.accounts !== 'object') {
    reject('GDPR_MODEL_SNAPSHOT_LINEAGE_INVALID');
  }
  const expected = new Map(committed.map(op => [op.id, sha(op)]));
  for (const [id, fingerprint] of snapshot.applied) {
    if (!expected.has(id) || expected.get(id) !== fingerprint)
      reject('GDPR_MODEL_SNAPSHOT_LINEAGE_INVALID');
  }
  const missingBySubject = new Set();
  const latestAppliedBySubject = new Map();
  for (const op of committed) {
    if (!snapshot.applied.has(op.id)) {
      missingBySubject.add(op.subject);
    } else {
      if (missingBySubject.has(op.subject))
        reject('GDPR_MODEL_SNAPSHOT_LINEAGE_INVALID');
      latestAppliedBySubject.set(op.subject, op.action);
    }
  }
  // A snapshot marker is not enough if its corresponding account state was
  // restored from a different point in time. Only verify subjects with an
  // applied marker; others have no proven baseline in this small model.
  for (const [subject, action] of latestAppliedBySubject) {
    const account = snapshot.accounts[subject];
    const expectedExists = action !== 'account_deleted';
    const expectedConsent = action === 'political_consent_granted';
    if (!account || account.exists !== expectedExists ||
        account.consent !== expectedConsent) {
      reject('GDPR_MODEL_SNAPSHOT_STATE_DIVERGENCE');
    }
  }
}

function submitSyntheticOperation(db,journal,raw,{crashAt=null}={}) {
  const op=checkOperation(raw);
  if (journal.sealed) reject('GDPR_MODEL_JOURNAL_SEALED');
  // A committed retry must never succeed using only a local SQL marker or a
  // stale/tampered journal. A live prefix may contain other pending subjects.
  if (journal.entries.length) journal.validatePrefix();
  const prior=journal.prior(op);
  if (prior === 'committed') {
    if (!db.hasExactCommit(op)) reject('GDPR_MODEL_DB_JOURNAL_DIVERGENCE');
    return {confirmed:true,reused:true};
  }
  // Unknown precommit outcome is never automatically acknowledged or retried.
  if (prior === 'pending') reject('GDPR_MODEL_AMBIGUOUS_INTENT');
  if (crashAt === 'before_prepare') reject('GDPR_MODEL_SIMULATED_CRASH');
  journal.prepare(op,{crashAfterWitness:crashAt === 'after_prepare_witness_ack'});
  if (crashAt === 'after_prepare') reject('GDPR_MODEL_SIMULATED_CRASH');
  db.apply(op);
  if (crashAt === 'after_db_commit') reject('GDPR_MODEL_SIMULATED_CRASH');
  journal.commit(op,{crashAfterWitness:crashAt === 'after_commit_witness_ack'});
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
  validateSyntheticSnapshotLineage(snapshot,operations);
  const restored=snapshot.snapshot();
  for (const op of operations) restored.apply(op);
  // Explicitly NEVER return a production recoveryReady or GO boolean.
  return {syntheticAdmission:true, productionRecoveryReady:false,
    replayed:operations.length, database:restored};
}

module.exports = {SyntheticWitness,SyntheticExternalJournal,SyntheticDatabase,
  submitSyntheticOperation,restoreSyntheticSnapshot};
