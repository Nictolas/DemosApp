'use strict';

/**
 * CI-only PostgreSQL 17 regression for replay-vs-consent-revocation.
 * No production routes, Supabase, JWT, actual subjects or persistent DDL.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { createCatalogRegistry, encodeEnvelope, decodeEnvelope } =
  require('../utils/opinionCodecEnvelope');

const DB = 'opinion_bitset_ci';
const TABLE = {
  subjects: 'ci_privacy_retry_subjects',
  votes: 'ci_privacy_retry_votes',
  requests: 'ci_privacy_retry_requests'
};
const IDS = ['synthetic_alpha', 'synthetic_beta'];
const registry = createCatalogRegistry([{ version: 1, ids: IDS }]);
const SUBJECTS = ['lost-ack', 'save-first', 'revoke-first', 'rollback'];
const hash = obj => crypto.createHash('sha256')
  .update(JSON.stringify(Object.entries(obj).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0))).digest('hex');

function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' || e.OPINION_BENCH_EPHEMERAL !== 'yes' ||
      e.PGHOST !== '127.0.0.1' || e.PGPORT !== '5432' ||
      e.PGDATABASE !== DB || e.PGUSER !== 'postgres' ||
      e.PGPASSWORD !== 'synthetic-only') {
    throw Error('Refusing consent/retry test outside disposable CI PostgreSQL');
  }
}
async function open(app) {
  const db = new Client({
    host: '127.0.0.1', port: 5432, database: DB,
    user: 'postgres', password: 'synthetic-only',
    application_name: app, statement_timeout: 12000
  });
  await db.connect();
  return db;
}
function gate() {
  let enteredResolve, releaseResolve;
  const entered = new Promise(resolve => { enteredResolve = resolve; });
  const releasePromise = new Promise(resolve => { releaseResolve = resolve; });
  return {
    entered,
    release: () => releaseResolve(),
    pause: async () => { enteredResolve(); await releasePromise; }
  };
}
async function timed(p, label) {
  let timer;
  try {
    return await Promise.race([
      p, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Timed out: ' + label)), 9000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function blocked(observer, waiting, holding, label) {
  for (let n = 0; n < 250; n++) {
    const result = await observer.query(
      'SELECT pg_blocking_pids($1::integer) AS blocking', [waiting]);
    if (result.rows[0].blocking.includes(holding)) return;
    await new Promise(resolve => setTimeout(resolve, 18));
  }
  throw Error('Expected a real PostgreSQL lock wait: ' + label);
}
async function init(db) {
  const info = (await db.query(
    "SELECT current_database() db,current_user actor," +
    "current_setting('server_version_num')::int version")).rows[0];
  assert.equal(info.db, DB);
  assert.equal(info.actor, 'postgres');
  assert.equal(Math.floor(info.version / 10000), 17);
  await db.query('CREATE TABLE ' + TABLE.subjects + ' (' +
    'subject text PRIMARY KEY, granted boolean NOT NULL,' +
    'consent_epoch integer NOT NULL CHECK(consent_epoch > 0))');
  await db.query('CREATE TABLE ' + TABLE.votes + ' (' +
    'subject text PRIMARY KEY REFERENCES ' + TABLE.subjects + '(subject),' +
    'payload bytea NOT NULL, catalog_version integer NOT NULL,' +
    'catalog_fingerprint text NOT NULL, encoding text NOT NULL,' +
    'revision integer NOT NULL CHECK(revision > 0))');
  await db.query('CREATE TABLE ' + TABLE.requests + ' (' +
    'subject text NOT NULL REFERENCES ' + TABLE.subjects + '(subject),' +
    'request_id text NOT NULL, consent_epoch integer NOT NULL,' +
    'payload_hash text NOT NULL, revision integer NOT NULL,' +
    'PRIMARY KEY(subject, request_id))');
  for (const sub of SUBJECTS) {
    await db.query('INSERT INTO ' + TABLE.subjects +
      ' (subject,granted,consent_epoch) VALUES($1,true,1)', [sub]);
  }
}
async function snapshot(db, subject) {
  const consent = (await db.query('SELECT granted,consent_epoch FROM ' +
    TABLE.subjects + ' WHERE subject=$1', [subject])).rows[0];
  const vote = (await db.query('SELECT * FROM ' + TABLE.votes +
    ' WHERE subject=$1', [subject])).rows[0] || null;
  const requests = (await db.query('SELECT request_id,consent_epoch,' +
    'payload_hash,revision FROM ' + TABLE.requests +
    ' WHERE subject=$1 ORDER BY request_id', [subject])).rows;
  return { consent, vote, requests };
}
function decodeVote(row) {
  if (!row) return null;
  return decodeEnvelope(registry, {
    schemaVersion: 1,
    catalogVersion: row.catalog_version,
    catalogFingerprint: row.catalog_fingerprint,
    encoding: row.encoding,
    payload: row.payload
  });
}
async function save(db, subject, requestId, clientEpoch, patch, options = {}) {
  assert.ok(SUBJECTS.includes(subject));
  assert.match(requestId, /^[a-z0-9-]{1,40}$/);
  assert.equal(typeof clientEpoch, 'number');
  assert.ok(patch && Object.keys(patch).length > 0);
  for (const [id, val] of Object.entries(patch)) {
    assert.ok(IDS.includes(id));
    assert.ok(['c','f','i'].includes(val));
  }
  const fingerprint = hash(patch);
  let tx = false, result;
  try {
    await db.query('BEGIN');
    tx = true;
    // Consent lock BEFORE any idempotency lookup, response replay or
    // opinion write. Reject old consent generations even after re-grant.
    const account = (await db.query(
      'SELECT granted,consent_epoch FROM ' + TABLE.subjects +
      ' WHERE subject=$1 FOR UPDATE', [subject])).rows[0];
    assert.ok(account);
    if (!account.granted) throw Error('CONSENT_DENIED');
    if (account.consent_epoch !== clientEpoch) {
      throw Error('STALE_CONSENT_EPOCH');
    }
    if (options.pause) await options.pause.pause();
    const old = (await db.query(
      'SELECT consent_epoch,payload_hash,revision FROM ' +
      TABLE.requests + ' WHERE subject=$1 AND request_id=$2',
      [subject, requestId])).rows[0];
    if (old) {
      if (old.consent_epoch !== clientEpoch || old.payload_hash !== fingerprint) {
        throw Error('IDEMPOTENCY_CONFLICT');
      }
      result = { replayed: true, revision: old.revision };
    } else {
      const prior = (await db.query('SELECT * FROM ' + TABLE.votes +
        ' WHERE subject=$1', [subject])).rows[0];
      const answers = { ...(decodeVote(prior) || {}), ...patch };
      const envelope = encodeEnvelope(registry,
        { version: 1, encoding: 'sparse', answers });
      const revision = prior ? prior.revision + 1 : 1;
      await db.query('INSERT INTO ' + TABLE.votes +
        ' (subject,payload,catalog_version,catalog_fingerprint,encoding,revision)' +
        ' VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(subject) DO UPDATE SET' +
        ' payload=EXCLUDED.payload,catalog_version=EXCLUDED.catalog_version,' +
        ' catalog_fingerprint=EXCLUDED.catalog_fingerprint,' +
        ' encoding=EXCLUDED.encoding,revision=EXCLUDED.revision',
        [subject,envelope.payload,envelope.catalogVersion,
          envelope.catalogFingerprint,envelope.encoding,revision]);
      await db.query('INSERT INTO ' + TABLE.requests +
        ' (subject,request_id,consent_epoch,payload_hash,revision)' +
        ' VALUES($1,$2,$3,$4,$5)',
        [subject,requestId,clientEpoch,fingerprint,revision]);
      result = { replayed: false, revision };
    }
    await db.query('COMMIT');
    tx = false;
  } catch (e) {
    if (tx) await db.query('ROLLBACK');
    throw e;
  }
  if (options.loseAcknowledgement) throw Error('SIMULATED_ACK_LOST');
  return result;
}
async function revoke(db, subject, options = {}) {
  assert.ok(SUBJECTS.includes(subject));
  let tx = false;
  try {
    await db.query('BEGIN');
    tx = true;
    // Same account row lock and lock order as save.
    const row = (await db.query('SELECT granted FROM ' + TABLE.subjects +
      ' WHERE subject=$1 FOR UPDATE', [subject])).rows[0];
    assert.ok(row);
    await db.query('UPDATE ' + TABLE.subjects +
      ' SET granted=false,consent_epoch=consent_epoch+1 WHERE subject=$1',
      [subject]);
    await db.query('DELETE FROM ' + TABLE.requests + ' WHERE subject=$1',
      [subject]);
    await db.query('DELETE FROM ' + TABLE.votes + ' WHERE subject=$1',
      [subject]);
    if (options.pause) await options.pause.pause();
    await db.query(options.rollback ? 'ROLLBACK' : 'COMMIT');
    tx = false;
  } catch (e) {
    if (tx) await db.query('ROLLBACK');
    throw e;
  }
}
async function regrant(db, subject) {
  // Re-grant is explicitly controlled by the caller, never by a retry.
  await db.query('BEGIN');
  try {
    await db.query('SELECT subject FROM ' + TABLE.subjects +
      ' WHERE subject=$1 FOR UPDATE', [subject]);
    const changed = await db.query('UPDATE ' + TABLE.subjects +
      ' SET granted=true,consent_epoch=consent_epoch+1' +
      ' WHERE subject=$1 AND granted=false RETURNING consent_epoch', [subject]);
    assert.equal(changed.rowCount, 1);
    await db.query('COMMIT');
    return changed.rows[0].consent_epoch;
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}
async function pid(db) {
  return (await db.query('SELECT pg_backend_pid() pid')).rows[0].pid;
}
async function main() {
  guard();
  const admin = await open('ci_privacy_retry_admin');
  let writer, revoker;
  try {
    await init(admin);
    writer = await open('ci_privacy_retry_writer');
    revoker = await open('ci_privacy_retry_revoker');
    const writerPid = await pid(writer);
    const revokePid = await pid(revoker);
    let blockedRaces = 0;

    // After successful COMMIT but lost HTTP ACK: retry is idempotent.
    await assert.rejects(save(writer, 'lost-ack', 'req-1', 1,
      { synthetic_alpha: 'f' }, { loseAcknowledgement: true }),
      /SIMULATED_ACK_LOST/);
    assert.deepEqual(await save(writer, 'lost-ack', 'req-1', 1,
      { synthetic_alpha: 'f' }), { replayed: true, revision: 1 });
    assert.equal((await snapshot(admin, 'lost-ack')).requests.length, 1);

    // Revocation purges BOTH BYTEA data and retry ledger atomically.
    await revoke(revoker, 'lost-ack');
    const afterRevoke = await snapshot(admin, 'lost-ack');
    assert.equal(afterRevoke.consent.granted, false);
    assert.equal(afterRevoke.consent.consent_epoch, 2);
    assert.equal(afterRevoke.vote, null);
    assert.equal(afterRevoke.requests.length, 0);
    await assert.rejects(save(writer, 'lost-ack', 'req-1', 1,
      { synthetic_alpha: 'f' }), /CONSENT_DENIED/);
    assert.equal((await snapshot(admin, 'lost-ack')).vote, null);

    // A previous token/request cannot resurrect data after new consent.
    assert.equal(await regrant(admin, 'lost-ack'), 3);
    await assert.rejects(save(writer, 'lost-ack', 'req-1', 1,
      { synthetic_alpha: 'f' }), /STALE_CONSENT_EPOCH/);
    assert.equal((await snapshot(admin, 'lost-ack')).vote, null);
    assert.deepEqual(await save(writer, 'lost-ack', 'fresh-epoch', 3,
      { synthetic_beta: 'i' }), { replayed: false, revision: 1 });
    const renewed = await snapshot(admin, 'lost-ack');
    assert.equal(decodeVote(renewed.vote).synthetic_alpha, null);
    assert.equal(decodeVote(renewed.vote).synthetic_beta, 'i');
    assert.deepEqual(renewed.requests.map(r => r.request_id), ['fresh-epoch']);

    // Save wins the row lock; revoke waits, then purges the committed save.
    const saveFirst = gate();
    const saving = save(writer, 'save-first', 'save-1', 1,
      { synthetic_alpha: 'c' }, { pause: saveFirst });
    await timed(saveFirst.entered, 'save-first gate entered');
    const revokingAfterSave = revoke(revoker, 'save-first');
    try {
      await blocked(admin, revokePid, writerPid, 'revoke behind save');
      blockedRaces++;
    } finally {
      saveFirst.release();
    }
    assert.deepEqual(await timed(saving, 'save-first completion'),
      { replayed: false, revision: 1 });
    await timed(revokingAfterSave, 'post-save revocation');
    const saveFirstFinal = await snapshot(admin, 'save-first');
    assert.equal(saveFirstFinal.vote, null);
    assert.equal(saveFirstFinal.requests.length, 0);
    assert.equal(saveFirstFinal.consent.granted, false);

    // Revoke wins the row lock; a pending save (even with fresh reqID)
    // must wait for COMMIT and then refuse to store or replay anything.
    const revokeFirst = gate();
    const revoking = revoke(revoker, 'revoke-first', { pause: revokeFirst });
    await timed(revokeFirst.entered, 'revoke-first gate entered');
    const lateSave = save(writer, 'revoke-first', 'late-1', 1,
      { synthetic_alpha: 'c' });
    try {
      await blocked(admin, writerPid, revokePid, 'save behind revoke');
      blockedRaces++;
    } finally {
      revokeFirst.release();
    }
    await timed(revoking, 'revoke-first commit');
    await assert.rejects(timed(lateSave, 'late save rejected'), /CONSENT_DENIED/);
    const revokedFirstFinal = await snapshot(admin, 'revoke-first');
    assert.equal(revokedFirstFinal.vote, null);
    assert.equal(revokedFirstFinal.requests.length, 0);
    assert.equal(revokedFirstFinal.consent.consent_epoch, 2);

    // If revocation fails and ROLLBACKs, both consent and ledger remain.
    assert.deepEqual(await save(writer, 'rollback', 'initial', 1,
      { synthetic_alpha: 'i' }), { replayed: false, revision: 1 });
    const original = await snapshot(admin, 'rollback');
    await revoke(revoker, 'rollback', { rollback: true });
    const afterRollback = await snapshot(admin, 'rollback');
    assert.deepEqual(afterRollback, original);
    assert.deepEqual(await save(writer, 'rollback', 'initial', 1,
      { synthetic_alpha: 'i' }), { replayed: true, revision: 1 });
    await assert.rejects(save(writer, 'rollback', 'initial', 1,
      { synthetic_alpha: 'f' }), /IDEMPOTENCY_CONFLICT/);

    assert.equal(blockedRaces, 2);
    console.log('OPINION_RETRY_REVOKE_PASS');
    console.log('OPINION_RETRY_REVOKE_RESULT_JSON=' + JSON.stringify({
      postgres: 17, synthetic: true,
      lostCommitAcknowledgementDeduplicated: true,
      consentCheckedBeforeIdempotencyReplay: true,
      revocationPurgesVotesAndRetryLedger: true,
      staleClientEpochRejectedAfterRegrant: true,
      bothRealLockOrderingRacesVerified: blockedRaces,
      saveFirstEventuallyPurged: true, revokeFirstNeverWrites: true,
      rollbackRestoresConsentVotesAndLedger: true,
      changedPayloadSameRequestRejected: true,
      noSupabaseAccess: true, noActualRoutesModified: true,
      limitations: [
        'Prototype-only consent epoch and request ledger; not deployed on DEMOS frontend or API.',
        'Epoch must be authenticated and refreshed by a trusted API before reuse; a client-controlled value alone proves no authorization.',
        'No persistent post-revocation tombstone is maintained; accepted old request IDs after re-grant need epoch binding.',
        'No real consent policy, Supabase RLS/pooler, Android, live request replay, backups or GDPR retention verification.'
      ]
    }));
  } finally {
    await Promise.allSettled([writer?.end(), revoker?.end(), admin.end()]);
  }
}
main().catch(e => {
  console.error('Synthetic consent/idempotency regression FAILED:', e);
  process.exitCode = 1;
});
