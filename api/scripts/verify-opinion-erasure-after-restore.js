'use strict';

/**
 * DOC-049 CI-ONLY. Deliberately restores a synthetic pre-erasure backup,
 * demonstrates that deleted opinions reappear, then blocks access and
 * replays a separately retained erasure journal before unsealing.
 * Not a production implementation or a complete offsite backup protocol.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { createCatalogRegistry, encodeEnvelope, decodeEnvelope } =
  require('../utils/opinionCodecEnvelope');
const { catalogFingerprint } = require('../utils/opinionBitset');

const SOURCE = 'opinion_bitset_ci';
const TARGET = 'opinion_erasure_restore_ci';
const T = {
  catalog: 'ci_erasure_catalog',
  subjects: 'ci_erasure_subjects',
  votes: 'ci_erasure_votes',
  requests: 'ci_erasure_requests',
  gate: 'ci_erasure_gate',
  journal: 'ci_erasure_journal'
};
const V1 = ['synthetic_alpha', 'synthetic_beta'];
const V2 = [...V1, 'synthetic_gamma'];
const SUBJECTS = ['synthetic_erased', 'synthetic_retained'];
const hash = obj => crypto.createHash('sha256')
  .update(JSON.stringify(Object.entries(obj).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0))).digest('hex');

function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' ||
      e.OPINION_BENCH_EPHEMERAL !== 'yes' ||
      e.PGHOST !== '127.0.0.1' || e.PGPORT !== '5432' ||
      e.PGDATABASE !== SOURCE || e.PGUSER !== 'postgres' ||
      e.PGPASSWORD !== 'synthetic-only' ||
      !['seed', 'revoke', 'verify'].includes(e.OPINION_ERASURE_PHASE)) {
    throw Error('Refusing restore-erasure probe outside disposable CI');
  }
  if (e.OPINION_ERASURE_PHASE === 'verify' &&
      e.OPINION_ERASURE_RESTORE_DB !== TARGET) {
    throw Error('Unexpected restore target');
  }
}
async function open(database, name) {
  const client = new Client({
    host: '127.0.0.1', port: 5432, database,
    user: 'postgres', password: 'synthetic-only',
    statement_timeout: 10000, application_name: name
  });
  await client.connect();
  return client;
}
async function identity(db, expected) {
  const row = (await db.query(
    "SELECT current_database() db,current_user actor," +
    "current_setting('server_version_num')::int version")).rows[0];
  assert.equal(row.db, expected);
  assert.equal(row.actor, 'postgres');
  assert.equal(Math.floor(row.version / 10000), 17);
}
async function reg(db) {
  const rows = (await db.query('SELECT * FROM ' + T.catalog +
    ' ORDER BY version')).rows;
  const registry = createCatalogRegistry(rows.map(r => ({
    version: r.version, ids: r.ordered_ids
  })));
  for (const row of rows) {
    assert.equal(row.fingerprint, registry.get(row.version).fingerprint);
  }
  assert.equal(registry.latestVersion, 2);
  return registry;
}
async function saveSeed(db, registry, subject, version, answers) {
  const envelope = encodeEnvelope(registry, {
    version, encoding: 'sparse', answers
  });
  await db.query('INSERT INTO ' + T.votes +
    ' (subject,catalog_version,catalog_fingerprint,encoding,payload,revision)' +
    ' VALUES($1,$2,$3,$4,$5,1)',
    [subject, envelope.catalogVersion, envelope.catalogFingerprint,
      envelope.encoding, envelope.payload]);
  await db.query('INSERT INTO ' + T.requests +
    ' (subject,request_id,consent_epoch,payload_hash,revision)' +
    ' VALUES($1,$2,1,$3,1)',
    [subject, 'original-request', hash(answers)]);
}
async function seed(db) {
  await db.query('CREATE TABLE ' + T.catalog + ' (' +
    'version integer PRIMARY KEY CHECK(version>0),' +
    'ordered_ids jsonb NOT NULL, fingerprint text NOT NULL)');
  await db.query('CREATE TABLE ' + T.subjects + ' (' +
    'subject text PRIMARY KEY, granted boolean NOT NULL,' +
    'consent_epoch integer NOT NULL CHECK(consent_epoch > 0))');
  await db.query('CREATE TABLE ' + T.votes + ' (' +
    'subject text PRIMARY KEY REFERENCES ' + T.subjects + '(subject),' +
    'catalog_version integer NOT NULL REFERENCES ' + T.catalog + '(version),' +
    'catalog_fingerprint text NOT NULL,encoding text NOT NULL,' +
    'payload bytea NOT NULL, revision integer NOT NULL)');
  await db.query('CREATE TABLE ' + T.requests + ' (' +
    'subject text NOT NULL REFERENCES ' + T.subjects + '(subject),' +
    'request_id text NOT NULL,consent_epoch integer NOT NULL,' +
    'payload_hash text NOT NULL, revision integer NOT NULL,' +
    'PRIMARY KEY(subject,request_id))');
  // Included in backup: every restore starts SEALED, fail-closed.
  await db.query('CREATE TABLE ' + T.gate + ' (' +
    'singleton boolean PRIMARY KEY CHECK(singleton),' +
    'sealed boolean NOT NULL CHECK(sealed OR last_event_seq >= 0),' +
    'last_event_seq bigint NOT NULL DEFAULT 0)');
  await db.query('INSERT INTO ' + T.gate +
    ' (singleton,sealed,last_event_seq) VALUES(true,true,0)');
  // Intentionally EXCLUDED from pg_dump. In this experiment, this ledger
  // is still on the SAME DB server, so does not survive total server loss.
  await db.query('CREATE TABLE ' + T.journal + ' (' +
    'seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,' +
    'subject text NOT NULL, new_consent_epoch integer NOT NULL,' +
    'kind text NOT NULL CHECK(kind = ' + "'REVOKED'" + '))');
  await db.query('INSERT INTO ' + T.catalog +
    ' (version,ordered_ids,fingerprint) VALUES(1,$1::jsonb,$2),(2,$3::jsonb,$4)',
    [JSON.stringify(V1), catalogFingerprint(V1),
      JSON.stringify(V2), catalogFingerprint(V2)]);
  for (const subject of SUBJECTS) {
    await db.query('INSERT INTO ' + T.subjects +
      ' (subject,granted,consent_epoch) VALUES($1,true,1)', [subject]);
  }
  const registry = await reg(db);
  await saveSeed(db, registry, SUBJECTS[0], 1,
    { synthetic_alpha: 'f' });
  await saveSeed(db, registry, SUBJECTS[1], 2,
    { synthetic_alpha: 'c', synthetic_gamma: 'i' });
  assert.equal((await db.query('SELECT count(*)::int n FROM ' +
    T.votes)).rows[0].n, 2);
  console.log('OPINION_ERASURE_PREBACKUP_SEEDED');
}
async function state(db, subject) {
  const consent = (await db.query('SELECT granted,consent_epoch FROM ' +
    T.subjects + ' WHERE subject=$1', [subject])).rows[0];
  assert.ok(consent);
  const vote = (await db.query('SELECT * FROM ' + T.votes +
    ' WHERE subject=$1', [subject])).rows[0] || null;
  const requests = (await db.query('SELECT * FROM ' + T.requests +
    ' WHERE subject=$1 ORDER BY request_id', [subject])).rows;
  return { consent, vote, requests };
}
async function revoked(db) {
  await db.query('BEGIN');
  try {
    const current = (await db.query('SELECT granted,consent_epoch FROM ' +
      T.subjects + ' WHERE subject=$1 FOR UPDATE', [SUBJECTS[0]])).rows[0];
    assert.equal(current.granted, true);
    assert.equal(current.consent_epoch, 1);
    const revocation = await db.query('UPDATE ' + T.subjects +
      ' SET granted=false,consent_epoch=consent_epoch+1' +
      ' WHERE subject=$1 RETURNING consent_epoch', [SUBJECTS[0]]);
    const epoch = revocation.rows[0].consent_epoch;
    await db.query('DELETE FROM ' + T.votes +
      ' WHERE subject=$1', [SUBJECTS[0]]);
    await db.query('DELETE FROM ' + T.requests +
      ' WHERE subject=$1', [SUBJECTS[0]]);
    // Consent, vote deletion and journal append are one PG transaction.
    await db.query('INSERT INTO ' + T.journal +
      ' (subject,new_consent_epoch,kind) VALUES($1,$2,$3)',
      [SUBJECTS[0], epoch, 'REVOKED']);
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
  const after = await state(db, SUBJECTS[0]);
  assert.equal(after.consent.granted, false);
  assert.equal(after.consent.consent_epoch, 2);
  assert.equal(after.vote, null);
  assert.equal(after.requests.length, 0);
  assert.equal((await db.query('SELECT count(*)::int n FROM ' +
    T.journal)).rows[0].n, 1);
  console.log('OPINION_ERASURE_SOURCE_REVOKED_AFTER_BACKUP');
}
async function gateStatus(db) {
  const { rows } = await db.query(
    'SELECT sealed,last_event_seq FROM ' + T.gate +
    ' WHERE singleton=true');
  assert.equal(rows.length, 1);
  return rows[0];
}
async function served(db, subject) {
  // A demo API gate only: raw DB access remains possible. Production
  // would have to enforce admission at ALL read/write pathways.
  if ((await gateStatus(db)).sealed) throw Error('RESTORE_SEALED');
  const record = await state(db, subject);
  if (!record.consent.granted) throw Error('CONSENT_DENIED');
  if (!record.vote) return null;
  const catalog = await reg(db);
  return decodeEnvelope(catalog, {
    schemaVersion: 1,
    catalogVersion: record.vote.catalog_version,
    catalogFingerprint: record.vote.catalog_fingerprint,
    encoding: record.vote.encoding,
    payload: record.vote.payload
  });
}
async function reconcile(source, target, options = {}) {
  if (options.journalAvailable === false) throw Error('JOURNAL_UNAVAILABLE');
  // This is NOT a distributed transaction/fence. A real deployment
  // would require a trusted durable offsite journal and a correct
  // watermark barrier across writes and backup restore.
  const events = (await source.query('SELECT seq,subject,new_consent_epoch,kind' +
    ' FROM ' + T.journal + ' ORDER BY seq ASC')).rows;
  if (!events.length) throw Error('ERASURE_JOURNAL_NOT_CONFIRMED');
  await target.query('BEGIN');
  try {
    const status = (await target.query(
      'SELECT sealed,last_event_seq FROM ' + T.gate +
      ' WHERE singleton=true FOR UPDATE')).rows[0];
    let currentSeq = Number(status.last_event_seq);
    for (const event of events) {
      const seq = Number(event.seq);
      assert.equal(event.kind, 'REVOKED');
      if (seq <= currentSeq) continue;
      assert.equal(seq, currentSeq + 1, 'ERASURE_JOURNAL_GAP');
      const updated = await target.query('UPDATE ' + T.subjects +
        ' SET granted=false,consent_epoch=GREATEST(consent_epoch,$2)' +
        ' WHERE subject=$1 RETURNING subject',
        [event.subject, event.new_consent_epoch]);
      assert.equal(updated.rowCount, 1,
        'Unknown erased subject must not be silently skipped');
      await target.query('DELETE FROM ' + T.votes +
        ' WHERE subject=$1', [event.subject]);
      await target.query('DELETE FROM ' + T.requests +
        ' WHERE subject=$1', [event.subject]);
      currentSeq = seq;
    }
    if (options.injectFailure) throw Error('INJECTED_REPLAY_FAILURE');
    assert.equal(currentSeq, Number(events.at(-1).seq));
    await target.query('UPDATE ' + T.gate +
      ' SET last_event_seq=$1,sealed=false WHERE singleton=true',
      [currentSeq]);
    await target.query('COMMIT');
    return currentSeq;
  } catch (e) {
    await target.query('ROLLBACK');
    throw e;
  }
}
async function verify(source, target) {
  const before = await state(target, SUBJECTS[0]);
  const live = await state(source, SUBJECTS[0]);
  const retained = await state(target, SUBJECTS[1]);
  assert.equal(live.vote, null);
  assert.equal(live.requests.length, 0);
  assert.equal(live.consent.granted, false);
  // Negative control: real pg_restore resurrected an already-deleted vote.
  assert.equal(before.consent.granted, true);
  assert.equal(before.consent.consent_epoch, 1);
  assert.ok(Buffer.isBuffer(before.vote.payload));
  assert.equal(before.requests.length, 1);
  const decodedOld = decodeEnvelope(await reg(target), {
    schemaVersion: 1, catalogVersion: before.vote.catalog_version,
    catalogFingerprint: before.vote.catalog_fingerprint,
    encoding: before.vote.encoding, payload: before.vote.payload
  });
  assert.equal(decodedOld.synthetic_alpha, 'f');
  assert.equal(decodedOld.synthetic_gamma, null);
  assert.equal(retained.consent.granted, true);
  assert.equal(retained.requests.length, 1);
  assert.equal((await gateStatus(target)).sealed, true);

  await assert.rejects(served(target, SUBJECTS[0]), /RESTORE_SEALED/);
  await assert.rejects(served(target, SUBJECTS[1]), /RESTORE_SEALED/);
  await assert.rejects(reconcile(source, target,
    { journalAvailable: false }), /JOURNAL_UNAVAILABLE/);
  assert.deepEqual(await state(target, SUBJECTS[0]), before);
  assert.equal((await gateStatus(target)).sealed, true);

  await assert.rejects(reconcile(source, target,
    { injectFailure: true }), /INJECTED_REPLAY_FAILURE/);
  assert.deepEqual(await state(target, SUBJECTS[0]), before,
    'Fault-injected replay must rollback all partial deletes');
  assert.equal((await gateStatus(target)).sealed, true);
  await assert.rejects(served(target, SUBJECTS[1]), /RESTORE_SEALED/);

  assert.equal(await reconcile(source, target), 1);
  const after = await state(target, SUBJECTS[0]);
  assert.equal(after.consent.granted, false);
  assert.equal(after.consent.consent_epoch, 2);
  assert.equal(after.vote, null);
  assert.equal(after.requests.length, 0);
  assert.equal((await gateStatus(target)).sealed, false);
  assert.equal(Number((await gateStatus(target)).last_event_seq), 1);
  await assert.rejects(served(target, SUBJECTS[0]), /CONSENT_DENIED/);
  const retainedAnswer = await served(target, SUBJECTS[1]);
  assert.equal(retainedAnswer.synthetic_alpha, 'c');
  assert.equal(retainedAnswer.synthetic_gamma, 'i');
  assert.deepEqual(await state(target, SUBJECTS[1]), retained);
  assert.equal(await reconcile(source, target), 1,
    'Erasure replay must be idempotent');
  assert.deepEqual(await state(target, SUBJECTS[0]), after);
  assert.deepEqual(await state(target, SUBJECTS[1]), retained);
  // A discarded idempotency key cannot be replayed as an old valid vote.
  assert.equal((await target.query('SELECT count(*)::int n FROM ' +
    T.requests + ' WHERE subject=$1', [SUBJECTS[0]])).rows[0].n, 0);
  console.log('OPINION_ERASURE_RESTORE_PASS');
  console.log('OPINION_ERASURE_RESTORE_RESULT_JSON=' + JSON.stringify({
    postgres: 17, synthetic: true,
    actualOlderPgDumpRestoredDeletedBYTEA: true,
    rawNegativeControlResurrectedVote: true,
    gatedReadDeniedUntilReconciliation: true,
    journalUnavailableFailsClosed: true,
    interruptedReconciliationRollsBack: true,
    externalRelativeToSnapshotJournalApplied: true,
    revokedVotesAndIdempotencyKeysReDeleted: true,
    historicalVersionedBYTEADecodesCorrectly: true,
    unrelatedSubjectUnaffected: true,
    repeatedErasureReplayIdempotent: true,
    actualSupabaseAccess: false,
    limitations: [
      'The journal is excluded from this dump but is on the SAME disposable server; server-wide loss would also lose the journal.',
      'The demo admission gate is an application check, not database privilege/RLS enforcement across all DEMOS routes.',
      'No real concurrent backup/restore/erasure watermark fencing, remote durability, PITR, encrypted storage, JWT or GDPR process is implemented.',
      'This negative control proves why older backups require safe erasure reconciliation; it does not prove production compliance.'
    ]
  }));
}
async function main() {
  guard();
  const phase = process.env.OPINION_ERASURE_PHASE;
  const source = await open(SOURCE, 'ci_erasure_' + phase);
  let target;
  try {
    await identity(source, SOURCE);
    if (phase === 'seed') await seed(source);
    if (phase === 'revoke') await revoked(source);
    if (phase === 'verify') {
      target = await open(TARGET, 'ci_erasure_restored');
      await identity(target, TARGET);
      await verify(source, target);
    }
  } finally {
    await Promise.allSettled([source.end(), target?.end()]);
  }
}
main().catch(e => {
  console.error('CI erasure/restoration safety experiment FAILED:', e);
  process.exitCode = 1;
});
