'use strict';

/**
 * CI ONLY. PostgreSQL transaction crash / reconnect regression with
 * synthetic versioned opinion payloads. No DEMOS accounts, routes,
 * Supabase connections, production credentials or persistent migrations.
 */
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { createCatalogRegistry, encodeEnvelope, decodeEnvelope } =
  require('../utils/opinionCodecEnvelope');
const { catalogFingerprint } = require('../utils/opinionBitset');

const DB = 'opinion_bitset_ci';
const TABLE = {
  catalog: 'ci_recovery_catalog_versions',
  head: 'ci_recovery_catalog_head',
  votes: 'ci_recovery_votes'
};
const IDS = Array.from({ length: 94 }, (_, i) => 'opinion' + i);
const config = app => ({
  host: '127.0.0.1', port: 5432, database: DB,
  user: 'postgres', password: 'synthetic-only',
  application_name: app, statement_timeout: 10000
});
function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' ||
      e.OPINION_BENCH_EPHEMERAL !== 'yes' ||
      e.PGHOST !== '127.0.0.1' ||
      e.PGPORT !== '5432' || e.PGDATABASE !== DB ||
      e.PGUSER !== 'postgres' || e.PGPASSWORD !== 'synthetic-only') {
    throw Error('Refusing crash/reconnect probe outside disposable CI PostgreSQL');
  }
}
async function open(app) {
  const c = new Client(config(app));
  // pg emits an error on backend termination even if a query is not pending.
  c.on('error', () => {});
  await c.connect();
  return c;
}
async function verifyLocal(db) {
  const { rows } = await db.query(
    'SELECT current_database() AS db, current_user AS actor, ' +
    "current_setting('server_version_num')::int AS ver");
  assert.equal(rows[0].db, DB);
  assert.equal(rows[0].actor, 'postgres');
  assert.equal(Math.floor(rows[0].ver / 10000), 17);
}
async function readRegistry(db) {
  const { rows } = await db.query(
    'SELECT version,ordered_ids,fingerprint FROM ' + TABLE.catalog +
    ' ORDER BY version ASC');
  const registry = createCatalogRegistry(rows.map(row => ({
    version: row.version, ids: row.ordered_ids
  })));
  for (const row of rows) {
    assert.equal(row.fingerprint, registry.get(row.version).fingerprint,
      'Fail closed on wrong persisted catalog fingerprint');
  }
  return registry;
}
async function readVote(db, subject, registry) {
  const { rows } = await db.query(
    'SELECT catalog_version,catalog_fingerprint,encoding,payload FROM ' +
    TABLE.votes + ' WHERE subject=$1', [subject]);
  assert.equal(rows.length, 1);
  const row = rows[0];
  return {
    version: row.catalog_version,
    decoded: decodeEnvelope(registry, {
      schemaVersion: 1,
      catalogVersion: row.catalog_version,
      catalogFingerprint: row.catalog_fingerprint,
      encoding: row.encoding,
      payload: row.payload
    })
  };
}
async function saveVote(db, subject, registry, answers) {
  const envelope = encodeEnvelope(registry, {
    version: registry.latestVersion, encoding: 'sparse', answers
  });
  await db.query(
    'INSERT INTO ' + TABLE.votes +
    ' (subject,catalog_version,catalog_fingerprint,encoding,payload)' +
    ' VALUES ($1,$2,$3,$4,$5)' +
    ' ON CONFLICT (subject) DO UPDATE SET ' +
    'catalog_version=EXCLUDED.catalog_version,' +
    'catalog_fingerprint=EXCLUDED.catalog_fingerprint,' +
    'encoding=EXCLUDED.encoding,payload=EXCLUDED.payload',
    [subject, envelope.catalogVersion, envelope.catalogFingerprint,
      envelope.encoding, envelope.payload]);
}
async function head(db) {
  const { rows } = await db.query(
    'SELECT version FROM ' + TABLE.head + ' WHERE singleton=true');
  assert.equal(rows.length, 1);
  return rows[0].version;
}
async function appendWithinTransaction(db, previousVersion, newId) {
  const { rows } = await db.query(
    'SELECT version FROM ' + TABLE.head +
    ' WHERE singleton=true FOR UPDATE');
  assert.equal(rows[0].version, previousVersion,
    'Append must use the current locked catalog head');
  const registry = await readRegistry(db);
  assert.equal(registry.latestVersion, previousVersion);
  const ids = [...registry.get(previousVersion).ids, newId];
  const version = previousVersion + 1;
  await db.query(
    'INSERT INTO ' + TABLE.catalog +
    ' (version,ordered_ids,fingerprint) VALUES ($1,$2::jsonb,$3)',
    [version, JSON.stringify(ids), catalogFingerprint(ids)]);
  await db.query(
    'UPDATE ' + TABLE.head + ' SET version=$1 WHERE singleton=true',
    [version]);
  return createCatalogRegistry([
    ...registry.versions.map(v => ({ version: v, ids: registry.get(v).ids })),
    { version, ids }
  ]);
}
async function main() {
  guard();
  const admin = await open('ci_recovery_admin');
  let interrupted;
  let committed;
  let reconnected;
  try {
    await verifyLocal(admin);
    await admin.query('CREATE TABLE ' + TABLE.catalog + ' (' +
      'version integer PRIMARY KEY CHECK(version>0),' +
      'ordered_ids jsonb NOT NULL,fingerprint text NOT NULL)');
    await admin.query('CREATE TABLE ' + TABLE.head + ' (' +
      'singleton boolean PRIMARY KEY CHECK(singleton),' +
      'version integer NOT NULL REFERENCES ' + TABLE.catalog + '(version))');
    await admin.query('CREATE TABLE ' + TABLE.votes + ' (' +
      'subject text PRIMARY KEY,' +
      'catalog_version integer NOT NULL REFERENCES ' + TABLE.catalog + '(version),' +
      'catalog_fingerprint text NOT NULL,encoding text NOT NULL,' +
      'payload bytea NOT NULL)');
    await admin.query('INSERT INTO ' + TABLE.catalog +
      ' (version,ordered_ids,fingerprint) VALUES (1,$1::jsonb,$2)',
      [JSON.stringify(IDS), catalogFingerprint(IDS)]);
    await admin.query('INSERT INTO ' + TABLE.head +
      ' (singleton,version) VALUES (true,1)');
    const first = await readRegistry(admin);
    await saveVote(admin, 'historical', first, { opinion0: 'f', opinion2: 'i' });
    const original = await readVote(admin, 'historical', first);

    // Simulate backend disappearing after SQL changes, but BEFORE COMMIT.
    interrupted = await open('ci_recovery_uncommitted');
    const pid = (await interrupted.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    await interrupted.query('BEGIN');
    const phantom = await appendWithinTransaction(
      interrupted, 1, 'new_uncommitted');
    await saveVote(interrupted, 'historical', phantom,
      { opinion0: 'c', new_uncommitted: 'i' });
    await saveVote(interrupted, 'phantom', phantom,
      { new_uncommitted: 'c' });

    // MVCC should hide both the uncommitted catalog and vote mutations.
    assert.equal(await head(admin), 1);
    assert.equal((await readRegistry(admin)).latestVersion, 1);
    assert.deepEqual(await readVote(admin, 'historical', first), original);
    assert.equal((await admin.query(
      'SELECT COUNT(*)::int n FROM ' + TABLE.votes)).rows[0].n, 1);
    assert.equal((await admin.query(
      'SELECT pg_terminate_backend($1) AS killed', [pid])).rows[0].killed, true);
    await assert.rejects(interrupted.query('SELECT 1'), /./);
    assert.equal(await head(admin), 1,
      'Backend crash must rollback uncommitted catalog head');
    assert.equal((await readRegistry(admin)).latestVersion, 1);
    assert.deepEqual(await readVote(admin, 'historical', first), original);
    assert.equal((await admin.query(
      'SELECT COUNT(*)::int n FROM ' + TABLE.votes)).rows[0].n, 1,
      'Uncommitted subject must not survive backend crash');

    // A new connection can append and commit, with old payload still readable.
    committed = await open('ci_recovery_committed');
    await committed.query('BEGIN');
    let next;
    try {
      next = await appendWithinTransaction(committed, 1, 'new_committed');
      await saveVote(committed, 'latest', next,
        { opinion1: 'c', new_committed: 'i' });
      await committed.query('COMMIT');
    } catch (e) {
      await committed.query('ROLLBACK');
      throw e;
    }
    const committedPid = (await committed.query(
      'SELECT pg_backend_pid() AS pid')).rows[0].pid;
    assert.equal((await admin.query(
      'SELECT pg_terminate_backend($1) AS killed',
      [committedPid])).rows[0].killed, true);
    reconnected = await open('ci_recovery_reconnected');
    const recovered = await readRegistry(reconnected);
    assert.equal(await head(reconnected), 2);
    assert.equal(recovered.latestVersion, 2);
    assert.deepEqual(recovered.get(2).ids,
      [...IDS, 'new_committed']);
    assert.equal(recovered.get(2).ids.includes('new_uncommitted'), false);
    const older = await readVote(reconnected, 'historical', recovered);
    assert.equal(older.version, 1);
    assert.equal(older.decoded.opinion0, 'f');
    assert.equal(older.decoded.opinion2, 'i');
    assert.equal(older.decoded.new_committed, null);
    const newer = await readVote(reconnected, 'latest', recovered);
    assert.equal(newer.version, 2);
    assert.equal(newer.decoded.opinion1, 'c');
    assert.equal(newer.decoded.new_committed, 'i');

    // A stale process MUST refresh rather than assign its v1 positions as v2.
    await reconnected.query('BEGIN');
    try {
      const locked = (await reconnected.query(
        'SELECT version FROM ' + TABLE.head +
        ' WHERE singleton=true FOR SHARE')).rows[0].version;
      assert.notEqual(first.latestVersion, locked);
      await reconnected.query('ROLLBACK');
    } catch (e) {
      await reconnected.query('ROLLBACK');
      throw e;
    }
    assert.equal((await admin.query(
      'SELECT COUNT(*)::int n FROM ' + TABLE.votes)).rows[0].n, 2);
    console.log('OPINION_CRASH_RECOVERY_PASS');
    console.log('OPINION_CRASH_RECOVERY_RESULT_JSON=' + JSON.stringify({
      postgres: 17, synthetic: true,
      uncommittedBackendTerminated: true,
      catalogAndVoteRollbackAtomic: true,
      committedCatalogSurvivedDisconnect: true,
      historyDecodedAcrossVersions: true,
      staleVersionDetectedOnReconnect: true,
      noSupabaseAccess: true, noRoutesModified: true,
      limitations: [
        'Backend termination is not a simulated full server outage.',
        'Does not demonstrate recovery after disk loss, failover, backup restore or ambiguous COMMIT acknowledgements.',
        'Does not exercise HTTP requests, Android, JWT, real RLS or consent.',
        'Tables are CI-only and must not be deployed or merged into production storage.'
      ]
    }));
  } finally {
    await Promise.allSettled([
      interrupted?.end(), committed?.end(), reconnected?.end(), admin.end()
    ]);
  }
}
main().catch(e => {
  console.error('Synthetic crash/reconnect probe FAILED:', e);
  process.exitCode = 1;
});
