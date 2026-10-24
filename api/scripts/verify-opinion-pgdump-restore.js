'use strict';

/**
 * CI-only verification after PostgreSQL 17 pg_dump/pg_restore.
 * Read source synthetic DB and distinct disposable restored DB, compare
 * catalog/order, BYTEA buffers and idempotency ledger. No DEMOS user data.
 */
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { createCatalogRegistry, decodeEnvelope } =
  require('../utils/opinionCodecEnvelope');

const MAIN = 'opinion_bitset_ci';
const RESTORE = 'opinion_bitset_restore_ci';
const TABLES = Object.freeze({
  catalog: 'ci_idem_catalog',
  head: 'ci_idem_head',
  subjects: 'ci_idem_subjects',
  votes: 'ci_idem_votes',
  requests: 'ci_idem_requests'
});
function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' ||
      e.OPINION_BENCH_EPHEMERAL !== 'yes' ||
      e.PGHOST !== '127.0.0.1' || e.PGPORT !== '5432' ||
      e.PGDATABASE !== MAIN || e.PGUSER !== 'postgres' ||
      e.PGPASSWORD !== 'synthetic-only' ||
      e.OPINION_RESTORE_DB !== RESTORE) {
    throw Error('Refusing pg_dump verification outside disposable CI');
  }
}
async function connect(db, app) {
  const c = new Client({
    host: '127.0.0.1', port: 5432, database: db,
    user: 'postgres', password: 'synthetic-only',
    application_name: app, statement_timeout: 10000
  });
  await c.connect();
  return c;
}
async function readTables(db) {
  const results = {};
  const ordering = {
    catalog: 'ORDER BY version',
    head: 'ORDER BY singleton',
    subjects: 'ORDER BY subject',
    votes: 'ORDER BY subject',
    requests: 'ORDER BY subject,request_id'
  };
  for (const [name, table] of Object.entries(TABLES)) {
    results[name] = (await db.query(
      'SELECT * FROM ' + table + ' ' + ordering[name])).rows;
  }
  return results;
}
function checkRegistry(rows) {
  const reg = createCatalogRegistry(rows.map(r => ({
    version: r.version, ids: r.ordered_ids
  })));
  for (const row of rows) {
    assert.equal(row.fingerprint, reg.get(row.version).fingerprint,
      'Persisted catalog fingerprint is not valid');
  }
  assert.equal(reg.latestVersion, 2);
  return reg;
}
function verifyDecoded(state, registry) {
  const votes = Object.fromEntries(state.votes.map(row => {
    const decoded = decodeEnvelope(registry, {
      schemaVersion: 1,
      catalogVersion: row.catalog_version,
      catalogFingerprint: row.catalog_fingerprint,
      encoding: row.encoding,
      payload: row.payload
    });
    return [row.subject, { row, decoded }];
  }));
  assert.equal(state.head.length, 1);
  assert.equal(state.head[0].singleton, true);
  assert.equal(state.head[0].version, 2);
  assert.equal(state.subjects.length, 2);
  assert.equal(state.votes.length, 2);
  assert.equal(state.requests.length, 7);
  assert.equal(votes.historical.row.catalog_version, 1);
  assert.equal(votes.historical.row.revision, 1);
  assert.equal(votes.historical.decoded.opinion3, 'i');
  assert.equal(votes.historical.decoded.new_synthetic, null);
  assert.equal(votes.test_account.row.catalog_version, 2);
  assert.equal(votes.test_account.row.revision, 6);
  assert.equal(votes.test_account.decoded.opinion0, 'f');
  assert.equal(votes.test_account.decoded.opinion1, 'c');
  assert.equal(votes.test_account.decoded.opinion2, 'i');
  assert.equal(votes.test_account.decoded.opinion4, 'f');
  assert.equal(votes.test_account.decoded.opinion5, 'c');
  assert.equal(votes.test_account.decoded.new_synthetic, 'c');

  const ledger = state.requests.find(r =>
    r.subject === 'test_account' && r.request_id === 'request-ack-lost');
  assert.ok(ledger, 'Lost-ACK request record must survive restore');
  assert.equal(ledger.applied_revision, 1);
  assert.match(ledger.fingerprint, /^[0-9a-f]{64}$/);
  return ledger;
}
async function main() {
  guard();
  const source = await connect(MAIN, 'ci_pgdump_source');
  let restored;
  try {
    restored = await connect(RESTORE, 'ci_pgdump_restored');
    for (const [db, expected] of [[source, MAIN], [restored, RESTORE]]) {
      const info = (await db.query(
        "SELECT current_database() db, current_user actor," +
        "current_setting('server_version_num')::int ver")).rows[0];
      assert.equal(info.db, expected);
      assert.equal(info.actor, 'postgres');
      assert.equal(Math.floor(info.ver / 10000), 17);
    }
    const before = await readTables(source);
    const after = await readTables(restored);
    // Buffer equality verifies exact BYTEA bytes, not only decoded answers.
    for (const table of Object.keys(TABLES)) {
      assert.deepEqual(after[table], before[table],
        'pg_dump/pg_restore changed table ' + table);
    }
    const sourceRegistry = checkRegistry(before.catalog);
    const restoredRegistry = checkRegistry(after.catalog);
    verifyDecoded(before, sourceRegistry);
    const ledger = verifyDecoded(after, restoredRegistry);

    // Retrying a previously committed request must not add a new key.
    await restored.query('BEGIN');
    try {
      const inserted = await restored.query(
        'INSERT INTO ' + TABLES.requests +
        ' (subject,request_id,fingerprint,applied_revision)' +
        ' VALUES ($1,$2,$3,$4)' +
        ' ON CONFLICT DO NOTHING RETURNING request_id',
        [ledger.subject, ledger.request_id,
          ledger.fingerprint, ledger.applied_revision]);
      assert.equal(inserted.rowCount, 0,
        'Lost-ACK ledger uniqueness was not restored');
      await restored.query('ROLLBACK');
    } catch (e) {
      await restored.query('ROLLBACK');
      throw e;
    }

    // Temporary target change cannot modify the original database.
    await restored.query('BEGIN');
    try {
      const changed = await restored.query(
        'UPDATE ' + TABLES.votes +
        ' SET revision=revision+1 WHERE subject=$1 RETURNING revision',
        ['test_account']);
      assert.equal(changed.rowCount, 1);
      assert.equal(changed.rows[0].revision, 7);
      const originalRevision = (await source.query(
        'SELECT revision FROM ' + TABLES.votes +
        ' WHERE subject=$1', ['test_account'])).rows[0].revision;
      assert.equal(originalRevision, 6, 'Restored DB changed source data');
      await restored.query('ROLLBACK');
    } catch (e) {
      await restored.query('ROLLBACK');
      throw e;
    }
    assert.deepEqual(await readTables(restored), after);

    console.log('OPINION_PGDUMP_RESTORE_PASS');
    console.log('OPINION_PGDUMP_RESTORE_RESULT_JSON=' + JSON.stringify({
      postgres: 17,
      synthetic: true,
      actualPgDumpAndPgRestore: true,
      restoredIntoDifferentEmptyDatabase: true,
      tablesCompared: Object.keys(TABLES).length,
      restoredSubjectCount: after.subjects.length,
      restoredBYTEARows: after.votes.length,
      restoredCatalogVersions: restoredRegistry.versions.length,
      restoredIdempotencyRecords: after.requests.length,
      exactByteBuffersAndCatalogMatch: true,
      historicalV1AndV2DecodeVerified: true,
      lostAcknowledgementRecordRestored: true,
      restoredDatabaseIndependentOfSource: true,
      noSupabaseAccess: true,
      limitations: [
        'This is a five-table custom-format pg_dump/pg_restore, not full cluster, WAL/PITR or automatic backup.',
        'Both databases use one disposable PG service; no remote site or true server failure simulated.',
        'Real RLS, JWT, GDPR, clients, Supabase pooler, restore permissions and costs remain untested.'
      ]
    }));
  } finally {
    await Promise.allSettled([source.end(), restored?.end()]);
  }
}
main().catch(e => {
  console.error('Isolated pg_dump/pg_restore validation FAILED:', e);
  process.exitCode = 1;
});
