'use strict';

/**
 * CI-ONLY prototype: at-least-once request retries, lost acknowledgements,
 * snapshot export and restoration of versioned binary opinions.
 * All names/data are synthetic. Never import this module from application routes.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('pg');
const { createCatalogRegistry, encodeEnvelope, decodeEnvelope } =
  require('../utils/opinionCodecEnvelope');
const { catalogFingerprint } = require('../utils/opinionBitset');
const DB = 'opinion_bitset_ci';
const PREFIX = 'ci_idem_';
const RESTORED = 'ci_idem_restored_';
const BROKEN = 'ci_idem_invalid_';
const IDS = Array.from({ length: 94 }, (_, i) => 'opinion' + i);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const config = app => ({
  host: '127.0.0.1', port: 5432, database: DB, user: 'postgres',
  password: 'synthetic-only', application_name: app, statement_timeout: 12000
});
function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' ||
      e.OPINION_BENCH_EPHEMERAL !== 'yes' ||
      e.PGHOST !== '127.0.0.1' || e.PGPORT !== '5432' ||
      e.PGDATABASE !== DB || e.PGUSER !== 'postgres' ||
      e.PGPASSWORD !== 'synthetic-only') {
    throw Error('Refusing retry/backup probe outside ephemeral CI Postgres');
  }
}
async function open(app) {
  const client = new Client(config(app));
  client.on('error', () => {});
  await client.connect();
  return client;
}
function tables(prefix) {
  if (![PREFIX, RESTORED, BROKEN].includes(prefix)) {
    throw Error('Refusing unknown SQL table prefix');
  }
  return Object.fromEntries(
    ['catalog', 'head', 'subjects', 'votes', 'requests']
      .map(k => [k, prefix + k])
  );
}
async function createSchema(db, prefix) {
  const t = tables(prefix);
  await db.query('CREATE TABLE ' + t.catalog + ' (' +
    'version integer PRIMARY KEY CHECK(version>0),' +
    'ordered_ids jsonb NOT NULL, fingerprint text NOT NULL)');
  await db.query('CREATE TABLE ' + t.head + ' (' +
    'singleton boolean PRIMARY KEY CHECK(singleton),' +
    'version integer NOT NULL REFERENCES ' + t.catalog + '(version))');
  await db.query('CREATE TABLE ' + t.subjects + ' (' +
    'subject text PRIMARY KEY)');
  await db.query('CREATE TABLE ' + t.votes + ' (' +
    'subject text PRIMARY KEY REFERENCES ' + t.subjects + '(subject),' +
    'catalog_version integer NOT NULL REFERENCES ' + t.catalog + '(version),' +
    'catalog_fingerprint text NOT NULL, encoding text NOT NULL,' +
    'payload bytea NOT NULL, revision integer NOT NULL CHECK(revision>0))');
  await db.query('CREATE TABLE ' + t.requests + ' (' +
    'subject text NOT NULL REFERENCES ' + t.subjects + '(subject),' +
    'request_id text NOT NULL, fingerprint text NOT NULL,' +
    'applied_revision integer NOT NULL DEFAULT 0 CHECK(applied_revision>=0),' +
    'PRIMARY KEY(subject, request_id))');
}
async function registry(db, prefix) {
  const t = tables(prefix);
  const rows = (await db.query('SELECT * FROM ' + t.catalog +
    ' ORDER BY version')).rows;
  const versioned = createCatalogRegistry(rows.map(r => ({
    version: r.version, ids: r.ordered_ids
  })));
  for (const row of rows) {
    assert.equal(row.fingerprint, versioned.get(row.version).fingerprint,
      'Corrupt catalog fingerprint: abort');
  }
  return versioned;
}
async function vote(db, prefix, subject, reg) {
  const t = tables(prefix);
  const { rows } = await db.query('SELECT * FROM ' + t.votes +
    ' WHERE subject=$1', [subject]);
  if (!rows.length) return null;
  const row = rows[0];
  return {
    version: row.catalog_version, revision: row.revision,
    decoded: decodeEnvelope(reg, {
      schemaVersion: 1,
      catalogVersion: row.catalog_version,
      catalogFingerprint: row.catalog_fingerprint,
      encoding: row.encoding, payload: row.payload
    })
  };
}
function validatePatch(reg, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) ||
      Object.keys(patch).length === 0) {
    throw Error('A nonempty answer patch is required');
  }
  const ids = new Set(reg.get(reg.latestVersion).ids);
  for (const [id, value] of Object.entries(patch)) {
    if (!ids.has(id) || !['f', 'c', 'i'].includes(value)) {
      throw Error('Invalid ID or opinion state');
    }
  }
}
function patchFingerprint(patch) {
  return hash(JSON.stringify(Object.entries(patch)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
}
async function saveDelta(db, prefix, subject, requestId, patch, opts = {}) {
  const t = tables(prefix);
  if (typeof subject !== 'string' || subject.length > 100 ||
      !/^[a-zA-Z0-9_-]{1,40}$/.test(requestId)) {
    throw Error('Invalid subject/request ID');
  }
  let openTransaction = false, result;
  try {
    await db.query('BEGIN');
    openTransaction = true;
    const head = (await db.query('SELECT version FROM ' + t.head +
      ' WHERE singleton=true FOR SHARE')).rows[0].version;
    const reg = await registry(db, prefix);
    assert.equal(reg.latestVersion, head);
    validatePatch(reg, patch);
    const fingerprint = patchFingerprint(patch);
    // Lock account BEFORE inserting the request row. The request FK would
    // otherwise acquire a KEY SHARE lock and deadlock with concurrent
    // FOR UPDATE of the same account.
    const locked = await db.query('SELECT subject FROM ' + t.subjects +
      ' WHERE subject=$1 FOR UPDATE', [subject]);
    assert.equal(locked.rowCount, 1);
    const claim = await db.query('INSERT INTO ' + t.requests +
      ' (subject,request_id,fingerprint) VALUES ($1,$2,$3)' +
      ' ON CONFLICT DO NOTHING RETURNING request_id',
    [subject, requestId, fingerprint]);
    if (claim.rowCount === 0) {
      const old = (await db.query(
        'SELECT fingerprint,applied_revision FROM ' + t.requests +
        ' WHERE subject=$1 AND request_id=$2',
        [subject, requestId])).rows[0];
      assert.ok(old, 'Conflicting request must exist after uniqueness wait');
      if (old.fingerprint !== fingerprint) {
        throw Error('IDEMPOTENCY_CONFLICT: request ID used with different payload');
      }
      assert.ok(old.applied_revision > 0);
      result = { replayed: true, revision: old.applied_revision };
    } else {
      // Serialize all distinct request IDs of a given account, including
      // initial INSERT, without serializing unrelated accounts.
      const prior = await vote(db, prefix, subject, reg);
      const merged = { ...(prior ? prior.decoded : {}), ...patch };
      const env = encodeEnvelope(reg, {
        version: reg.latestVersion, encoding: 'sparse', answers: merged
      });
      const revision = prior ? prior.revision + 1 : 1;
      await db.query('INSERT INTO ' + t.votes +
        ' (subject,catalog_version,catalog_fingerprint,encoding,payload,revision)' +
        ' VALUES ($1,$2,$3,$4,$5,$6)' +
        ' ON CONFLICT (subject) DO UPDATE SET ' +
        'catalog_version=EXCLUDED.catalog_version,' +
        'catalog_fingerprint=EXCLUDED.catalog_fingerprint,' +
        'encoding=EXCLUDED.encoding,payload=EXCLUDED.payload,' +
        'revision=EXCLUDED.revision',
        [subject, env.catalogVersion, env.catalogFingerprint,
          env.encoding, env.payload, revision]);
      await db.query('UPDATE ' + t.requests +
        ' SET applied_revision=$1 WHERE subject=$2 AND request_id=$3',
        [revision, subject, requestId]);
      result = { replayed: false, revision };
    }
    await db.query('COMMIT');
    openTransaction = false;
  } catch (e) {
    if (openTransaction) await db.query('ROLLBACK');
    throw e;
  }
  // The COMMIT succeeded, but HTTP/proxy/client might lose the ACK.
  // The simulated failure is injected AFTER COMMIT, not inside SQL.
  if (opts.simulateLostAcknowledgement) {
    throw Error('SIMULATED_COMMIT_ACK_LOST');
  }
  return result;
}
async function appendCatalog(db) {
  const t = tables(PREFIX);
  await db.query('BEGIN');
  try {
    const before = (await db.query('SELECT version FROM ' + t.head +
      ' WHERE singleton=true FOR UPDATE')).rows[0].version;
    const old = await registry(db, PREFIX);
    assert.equal(before, old.latestVersion);
    const ids = [...old.get(before).ids, 'new_synthetic'];
    await db.query('INSERT INTO ' + t.catalog +
      ' (version,ordered_ids,fingerprint) VALUES ($1,$2::jsonb,$3)',
      [before + 1, JSON.stringify(ids), catalogFingerprint(ids)]);
    await db.query('UPDATE ' + t.head +
      ' SET version=$1 WHERE singleton=true', [before + 1]);
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}
async function exportBackup(db, onSnapshotOpen) {
  const t = tables(PREFIX);
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const head = (await db.query('SELECT singleton,version FROM ' + t.head +
      ' WHERE singleton=true')).rows;
    // This read fixes a single MVCC snapshot for all subsequent tables.
    if (onSnapshotOpen) await onSnapshotOpen();
    const catalog = (await db.query('SELECT * FROM ' + t.catalog +
      ' ORDER BY version')).rows;
    const subjects = (await db.query('SELECT * FROM ' + t.subjects +
      ' ORDER BY subject')).rows;
    const votes = (await db.query('SELECT * FROM ' + t.votes +
      ' ORDER BY subject')).rows.map(r => ({
        ...r, payload: r.payload.toString('base64')
      }));
    const requests = (await db.query('SELECT * FROM ' + t.requests +
      ' ORDER BY subject,request_id')).rows;
    await db.query('COMMIT');
    const payload = { schema: 1, head, catalog, subjects, votes, requests };
    return { payload, sha256: hash(JSON.stringify(payload)) };
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}
function validateBackup(backup) {
  if (!backup || !backup.payload || backup.payload.schema !== 1 ||
      !/^[0-9a-f]{64}$/.test(backup.sha256 || '') ||
      hash(JSON.stringify(backup.payload)) !== backup.sha256) {
    throw Error('BACKUP_CHECKSUM_OR_SCHEMA_MISMATCH');
  }
  const p = backup.payload;
  for (const key of ['head', 'catalog', 'subjects', 'votes', 'requests']) {
    if (!Array.isArray(p[key])) throw Error('Malformed backup collection: ' + key);
  }
  if (p.head.length !== 1) throw Error('Malformed catalog head');
  return p;
}
async function restore(db, prefix, backup) {
  const p = validateBackup(backup);
  const t = tables(prefix);
  await db.query('BEGIN');
  try {
    await createSchema(db, prefix);
    for (const r of p.catalog) {
      await db.query('INSERT INTO ' + t.catalog +
        ' (version,ordered_ids,fingerprint) VALUES($1,$2::jsonb,$3)',
        [r.version, JSON.stringify(r.ordered_ids), r.fingerprint]);
    }
    for (const r of p.head) {
      await db.query('INSERT INTO ' + t.head +
        ' (singleton,version) VALUES($1,$2)', [r.singleton, r.version]);
    }
    for (const r of p.subjects) {
      await db.query('INSERT INTO ' + t.subjects +
        ' (subject) VALUES($1)', [r.subject]);
    }
    for (const r of p.votes) {
      await db.query('INSERT INTO ' + t.votes +
        ' (subject,catalog_version,catalog_fingerprint,encoding,payload,revision)' +
        ' VALUES($1,$2,$3,$4,$5,$6)',
        [r.subject, r.catalog_version, r.catalog_fingerprint,
          r.encoding, Buffer.from(r.payload, 'base64'), r.revision]);
    }
    for (const r of p.requests) {
      await db.query('INSERT INTO ' + t.requests +
        ' (subject,request_id,fingerprint,applied_revision)' +
        ' VALUES($1,$2,$3,$4)',
        [r.subject, r.request_id, r.fingerprint, r.applied_revision]);
    }
    const reg = await registry(db, prefix);
    assert.equal(reg.latestVersion, p.head[0].version);
    for (const r of p.votes) {
      const restored = await vote(db, prefix, r.subject, reg);
      assert.equal(restored.revision, r.revision);
      assert.equal(restored.version, r.catalog_version);
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}
async function main() {
  guard();
  const admin = await open('ci_idempotency_admin');
  let writer, other, backupConnection, restoredConnection;
  let tmp;
  try {
    const identity = (await admin.query(
      "SELECT current_database() db,current_user actor," +
      "current_setting('server_version_num')::int version")).rows[0];
    assert.equal(identity.db, DB);
    assert.equal(identity.actor, 'postgres');
    assert.equal(Math.floor(identity.version / 10000), 17);
    await createSchema(admin, PREFIX);
    const t = tables(PREFIX);
    await admin.query('INSERT INTO ' + t.catalog +
      ' (version,ordered_ids,fingerprint) VALUES(1,$1::jsonb,$2)',
      [JSON.stringify(IDS), catalogFingerprint(IDS)]);
    await admin.query('INSERT INTO ' + t.head +
      ' (singleton,version) VALUES(true,1)');
    await admin.query('INSERT INTO ' + t.subjects +
      " (subject) VALUES('test_account'),('historical')");
    writer = await open('ci_idempotency_writer_a');
    other = await open('ci_idempotency_writer_b');
    const v1 = await registry(admin, PREFIX);
    await saveDelta(admin, PREFIX, 'historical', 'old-v1',
      { opinion3: 'i' });
    await assert.rejects(saveDelta(writer, PREFIX, 'test_account',
      'request-ack-lost', { opinion0: 'f' },
      { simulateLostAcknowledgement: true }), /SIMULATED_COMMIT_ACK_LOST/);
    assert.equal((await vote(admin, PREFIX, 'test_account', v1)).revision, 1);
    const retry = await saveDelta(other, PREFIX, 'test_account',
      'request-ack-lost', { opinion0: 'f' });
    assert.deepEqual(retry, { replayed: true, revision: 1 });
    await assert.rejects(saveDelta(other, PREFIX, 'test_account',
      'request-ack-lost', { opinion0: 'c' }), /IDEMPOTENCY_CONFLICT/);
    assert.equal((await vote(admin, PREFIX, 'test_account', v1)).revision, 1);

    const duplicates = await Promise.all([
      saveDelta(writer, PREFIX, 'test_account', 'same-parallel',
        { opinion1: 'c' }),
      saveDelta(other, PREFIX, 'test_account', 'same-parallel',
        { opinion1: 'c' })
    ]);
    assert.deepEqual(duplicates.map(x => x.revision), [2, 2]);
    assert.equal(duplicates.filter(x => !x.replayed).length, 1);
    assert.equal((await vote(admin, PREFIX, 'test_account', v1)).revision, 2);

    const separate = await Promise.all([
      saveDelta(writer, PREFIX, 'test_account', 'independent-a',
        { opinion2: 'i' }),
      saveDelta(other, PREFIX, 'test_account', 'independent-b',
        { opinion4: 'f' })
    ]);
    assert.deepEqual(separate.map(x => x.revision).sort(), [3, 4]);
    const current = await vote(admin, PREFIX, 'test_account', v1);
    assert.equal(current.revision, 4);
    assert.equal(current.decoded.opinion0, 'f');
    assert.equal(current.decoded.opinion1, 'c');
    assert.equal(current.decoded.opinion2, 'i');
    assert.equal(current.decoded.opinion4, 'f');

    await appendCatalog(admin);
    const v2 = await registry(admin, PREFIX);
    assert.equal(v2.latestVersion, 2);
    assert.equal((await vote(admin, PREFIX, 'historical', v2)).version, 1);
    assert.equal((await vote(admin, PREFIX, 'historical', v2))
      .decoded.new_synthetic, null);
    assert.deepEqual(await saveDelta(writer, PREFIX, 'test_account',
      'after-append', { new_synthetic: 'c' }),
      { replayed: false, revision: 5 });

    // Snapshot is fixed before a concurrent source update is committed.
    backupConnection = await open('ci_idempotency_backup');
    const snapshot = await exportBackup(backupConnection, async () => {
      assert.deepEqual(await saveDelta(other, PREFIX, 'test_account',
        'after-snapshot', { opinion5: 'c' }),
        { replayed: false, revision: 6 });
    });
    const frozen = snapshot.payload.votes.find(
      r => r.subject === 'test_account');
    assert.equal(frozen.revision, 5);
    assert.equal((await vote(admin, PREFIX, 'test_account', v2)).revision, 6);
    assert.equal(snapshot.payload.requests.some(
      r => r.request_id === 'after-snapshot'), false);

    // Round-trip the logical snapshot through an ephemeral backup file.
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-synthetic-backup-'));
    const filename = path.join(tmp, 'opinions.json');
    fs.writeFileSync(filename, JSON.stringify(snapshot), { mode: 0o600 });
    const fromFile = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const altered = structuredClone(fromFile);
    altered.payload.votes[0].payload = 'YWJj';
    await assert.rejects(restore(admin, BROKEN, altered),
      /BACKUP_CHECKSUM_OR_SCHEMA_MISMATCH/);
    assert.equal((await admin.query(
      'SELECT to_regclass($1)::text AS table_name',
      ['public.' + tables(BROKEN).catalog])).rows[0].table_name, null);

    // Even a rehashed but semantically broken fixture must roll back all DDL.
    const badReference = structuredClone(fromFile);
    badReference.payload.votes[0].catalog_version = 999;
    badReference.sha256 = hash(JSON.stringify(badReference.payload));
    await assert.rejects(restore(admin, BROKEN, badReference), /./);
    assert.equal((await admin.query(
      'SELECT to_regclass($1)::text AS table_name',
      ['public.' + tables(BROKEN).catalog])).rows[0].table_name, null);

    await restore(admin, RESTORED, fromFile);
    restoredConnection = await open('ci_idempotency_restored');
    const recovered = await registry(restoredConnection, RESTORED);
    assert.equal(recovered.latestVersion, 2);
    assert.deepEqual(recovered.get(1).ids, IDS);
    assert.deepEqual(recovered.get(2).ids, [...IDS, 'new_synthetic']);
    const historical = await vote(restoredConnection, RESTORED,
      'historical', recovered);
    assert.equal(historical.version, 1);
    assert.equal(historical.decoded.opinion3, 'i');
    assert.equal(historical.decoded.new_synthetic, null);
    const restored = await vote(restoredConnection, RESTORED,
      'test_account', recovered);
    assert.equal(restored.version, 2);
    assert.equal(restored.revision, 5);
    assert.equal(restored.decoded.new_synthetic, 'c');
    assert.equal(restored.decoded.opinion5, null);
    const replayAfterRestore = await saveDelta(restoredConnection, RESTORED,
      'test_account', 'request-ack-lost', { opinion0: 'f' });
    assert.deepEqual(replayAfterRestore, { replayed: true, revision: 1 });
    assert.equal((await vote(restoredConnection, RESTORED,
      'test_account', recovered)).revision, 5);
    assert.equal((await admin.query('SELECT COUNT(*)::int n FROM ' +
      tables(RESTORED).requests)).rows[0].n,
      snapshot.payload.requests.length);

    console.log('OPINION_RETRY_BACKUP_PASS');
    console.log('OPINION_RETRY_BACKUP_RESULT_JSON=' + JSON.stringify({
      postgres: 17, synthetic: true, lostAckAfterCommitReplayed: true,
      reusedRequestWithAlteredPayloadRejected: true,
      concurrentDuplicateExactlyOnceApplied: true,
      concurrentDistinctPatchesPreserved: true,
      consistentSnapshotDuringConcurrentSourceUpdate: true,
      backupFileRoundTrip: true, tamperedChecksumRejected: true,
      invalidForeignKeyRestoreRolledBack: true,
      versionedHistoricalOpinionsRestored: true,
      requestLedgerRestoredAndRetryDeduplicated: true,
      restoredRevision: 5, sourceRevisionAfterSnapshot: 6,
      noSupabaseAccess: true, noRealRoutesWired: true,
      limitations: [
        'Idempotency is a prototype with synthetic subject locking and a SQL request ledger, not deployed HTTP middleware.',
        'A deterministic replay needs clients to reuse the same request ID; no such client contract is deployed.',
        'Logical JSON snapshot only, not pg_dump/PITR, physical backup, failover, remote storage or disk loss.',
        'SHA-256 detects inadvertent changes but is not a signature; a malicious replacement can recompute it.',
        'No production retention/purge policy, consent race, real JWT/RLS, Supabase pooler or Android testing.'
      ]
    }));
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    await Promise.allSettled([
      writer?.end(), other?.end(), backupConnection?.end(),
      restoredConnection?.end(), admin.end()
    ]);
  }
}
main().catch(e => {
  console.error('Synthetic retry and backup test FAILED:', e);
  process.exitCode = 1;
});
