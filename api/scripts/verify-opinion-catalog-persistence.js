'use strict';

/**
 * CI-ONLY, DESTRUCTIVE SYNTHETIC EXPERIMENT on the disposable GitHub Actions
 * PostgreSQL 17 service. Never import or run in any DEMOS runtime.
 *
 * Tests durable *within the ephemeral Actions service* catalog rows across
 * distinct PG sessions, historical BYTEA decoding, and serialized appends.
 * It does not prove production backup, RLS, replica safety, or migrations.
 */
const assert = require('node:assert/strict');
const {Client} = require('pg');
const {
  createCatalogRegistry, encodeEnvelope, decodeEnvelope, upgradeEnvelope
} = require('../utils/opinionCodecEnvelope');
const {
  serializeCatalogRegistry, restoreCatalogRegistry
} = require('../utils/opinionCatalogManifest');

const DB = 'opinion_bitset_ci';
const VERSION_TABLE = 'ci_opinion_catalog_versions';
const VOTES_TABLE = 'ci_opinion_catalog_votes';
const CATALOG_LOCK = 2470029;

function guardEphemeral() {
  const valid = process.env.GITHUB_ACTIONS === 'true' &&
    process.env.OPINION_BENCH_EPHEMERAL === 'yes' &&
    process.env.PGHOST === '127.0.0.1' &&
    process.env.PGDATABASE === DB &&
    process.env.PGUSER === 'postgres' &&
    process.env.PGPORT === '5432' &&
    process.env.PGPASSWORD === 'synthetic-only';
  if (!valid) {
    throw new Error('Refusing catalog persistence test outside synthetic GitHub Actions PostgreSQL');
  }
}

async function connect() {
  const client = new Client({
    host:'127.0.0.1',port:5432,database:DB,
    user:'postgres',password:'synthetic-only',statement_timeout:10000,
    application_name:'opinion_catalog_synthetic_ci'
  });
  await client.connect();
  const actual = await client.query('SELECT current_database() AS name, current_user AS role_name');
  assert.equal(actual.rows[0].name,DB);
  assert.equal(actual.rows[0].role_name,'postgres');
  return client;
}

async function createSyntheticTables(client) {
  // This schema is created ONLY inside the disposable GitHub Actions service.
  await client.query('CREATE TABLE '+VERSION_TABLE+' ('+
    'version integer PRIMARY KEY CHECK (version > 0), '+
    "ordered_ids jsonb NOT NULL CHECK (jsonb_typeof(ordered_ids) = 'array'), "+
    "fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'))");
  await client.query('CREATE TABLE '+VOTES_TABLE+' ('+
    'synthetic_subject text PRIMARY KEY, '+
    'catalog_version integer NOT NULL REFERENCES '+VERSION_TABLE+'(version), '+
    "encoding text NOT NULL CHECK (encoding IN ('fixed','trimmed','sparse')), "+
    "catalog_fingerprint text NOT NULL CHECK (catalog_fingerprint ~ '^[0-9a-f]{64}$'), "+
    'payload bytea NOT NULL)');
}

async function loadRegistry(client) {
  const result = await client.query('SELECT version,ordered_ids,fingerprint FROM '+
    VERSION_TABLE+' ORDER BY version ASC');
  if (!result.rows.length) throw new RangeError('No durable catalog versions');
  const snapshot = {
    schemaVersion:1,
    catalogs:result.rows.map(row=>({
      version:row.version,ids:row.ordered_ids,fingerprint:row.fingerprint
    }))
  };
  return restoreCatalogRegistry(JSON.stringify(snapshot));
}

async function insertFirstCatalog(client,ids) {
  const registry = createCatalogRegistry([{version:1,ids}]);
  const first = registry.get(1);
  await client.query('INSERT INTO '+VERSION_TABLE+
    ' (version,ordered_ids,fingerprint) VALUES ($1,$2::jsonb,$3)',
    [first.version,JSON.stringify(first.ids),first.fingerprint]);
  return registry;
}

async function appendCatalog(client,expectedLatest,ids) {
  await client.query('BEGIN');
  try {
    // All prototype writers must acquire the same transaction-scoped lock.
    // Reject stale expectedLatest before inserting, rather than forking slots.
    await client.query('SELECT pg_advisory_xact_lock($1)',[CATALOG_LOCK]);
    const previous = await loadRegistry(client);
    if (previous.latestVersion !== expectedLatest) {
      throw new RangeError('Stale opinion catalog version; retry from latest');
    }
    const specs = previous.versions.map(version=>({
      version,ids:previous.get(version).ids
    }));
    const newVersion = expectedLatest+1;
    specs.push({version:newVersion,ids});
    const registry = createCatalogRegistry(specs); // append-only & unique IDs
    const next = registry.get(newVersion);
    await client.query('INSERT INTO '+VERSION_TABLE+
      ' (version,ordered_ids,fingerprint) VALUES ($1,$2::jsonb,$3)',
      [newVersion,JSON.stringify(next.ids),next.fingerprint]);
    await client.query('COMMIT');
    return newVersion;
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function storeVote(client,subject,envelope) {
  await client.query('INSERT INTO '+VOTES_TABLE+
    ' (synthetic_subject,catalog_version,encoding,catalog_fingerprint,payload) '+
    'VALUES ($1,$2,$3,$4,$5)',
    [subject,envelope.catalogVersion,envelope.encoding,
      envelope.catalogFingerprint,envelope.payload]);
}

async function readVote(client,subject) {
  const result = await client.query('SELECT catalog_version,encoding,'+
    'catalog_fingerprint,payload FROM '+VOTES_TABLE+
    ' WHERE synthetic_subject=$1',[subject]);
  assert.equal(result.rowCount,1);
  const row = result.rows[0];
  return {
    schemaVersion:1,
    catalogVersion:row.catalog_version,
    catalogFingerprint:row.catalog_fingerprint,
    encoding:row.encoding,
    payload:row.payload
  };
}

async function main() {
  guardEphemeral();
  const idsV1=['synthetic_alpha','synthetic_beta','synthetic_gamma'];
  const idsV2=[...idsV1,'synthetic_delta'];
  const client = await connect();
  let serializedV1;
  let base;
  try {
    await createSyntheticTables(client);
    base = await insertFirstCatalog(client,idsV1);
    serializedV1 = serializeCatalogRegistry(base);
    for (const encoding of ['fixed','trimmed','sparse']) {
      const packed = encodeEnvelope(base,{
        version:1,encoding,
        answers:{synthetic_alpha:'f',synthetic_beta:'c',synthetic_gamma:'i'}
      });
      await storeVote(client,'synthetic_subject_'+encoding,packed);
    }
  } finally {
    await client.end();
  }

  // New database connection emulates a server process restart. Actual
  // PostgreSQL service remains live (no filesystem snapshot or restore).
  const afterRestart = await connect();
  let second;
  try {
    const restored = await loadRegistry(afterRestart);
    assert.equal(serializeCatalogRegistry(restored),serializedV1);
    assert.notStrictEqual(restored,base);
    for (const encoding of ['fixed','trimmed','sparse']) {
      const persisted = await readVote(afterRestart,'synthetic_subject_'+encoding);
      assert.deepEqual(decodeEnvelope(restored,persisted),{
        synthetic_alpha:'f',synthetic_beta:'c',synthetic_gamma:'i'
      });
    }
    await assert.rejects(
      appendCatalog(afterRestart,1,['synthetic_beta','synthetic_alpha',
        'synthetic_gamma','synthetic_delta']),
      /reorder|remove|Catalog versions/i);
    assert.equal((await loadRegistry(afterRestart)).latestVersion,1);
    assert.equal(await appendCatalog(afterRestart,1,idsV2),2);
    const v2 = await loadRegistry(afterRestart);
    const newVote = encodeEnvelope(v2,{
      version:2,encoding:'trimmed',answers:{synthetic_delta:'i'}
    });
    await storeVote(afterRestart,'synthetic_subject_v2',newVote);
    for (const encoding of ['fixed','trimmed','sparse']) {
      const persisted = await readVote(afterRestart,'synthetic_subject_'+encoding);
      assert.deepEqual(decodeEnvelope(v2,persisted),{
        synthetic_alpha:'f',synthetic_beta:'c',
        synthetic_gamma:'i',synthetic_delta:null
      });
    }
    assert.deepEqual(decodeEnvelope(v2,await readVote(afterRestart,
      'synthetic_subject_v2')),{synthetic_alpha:null,synthetic_beta:null,
      synthetic_gamma:null,synthetic_delta:'i'});
    assert.throws(()=>decodeEnvelope(base,newVote),/Unknown catalog version/);

    // Force a stale concurrent writer: both compete to append from version 2.
    // Advisory lock serializes cooperating writers and stale-version check
    // rejects the loser; no duplicate version or reordered slot can survive.
    second = await connect();
    const attempts = await Promise.allSettled([
      appendCatalog(afterRestart,2,[...idsV2,'synthetic_epsilon']),
      appendCatalog(second,2,[...idsV2,'synthetic_zeta'])
    ]);
    assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
    const rejected=attempts.filter(x=>x.status==='rejected');
    assert.equal(rejected.length,1);
    assert.match(rejected[0].reason.message,/Stale opinion catalog version/);
    const latest = await loadRegistry(afterRestart);
    assert.equal(latest.latestVersion,3);
    assert.deepEqual(latest.get(3).ids.slice(0,idsV2.length),idsV2);
    assert.equal((await afterRestart.query('SELECT COUNT(*)::int AS count FROM '+
      VERSION_TABLE)).rows[0].count,3);

    // A changed fingerprint on disk is detected at the next catalog load.
    await afterRestart.query('BEGIN');
    try {
      await afterRestart.query('UPDATE '+VERSION_TABLE+
        " SET fingerprint=$1 WHERE version=1",['0'.repeat(64)]);
      await assert.rejects(loadRegistry(afterRestart),/fingerprint/i);
    } finally {
      await afterRestart.query('ROLLBACK');
    }
    assert.equal((await loadRegistry(afterRestart)).latestVersion,3);

    // Verify persisted blobs are checked against the recovered catalog.
    await afterRestart.query('BEGIN');
    try {
      await afterRestart.query('UPDATE '+VOTES_TABLE+
        ' SET catalog_fingerprint=$1 WHERE synthetic_subject=$2',
        ['0'.repeat(64),'synthetic_subject_fixed']);
      const corrupted = await readVote(afterRestart,'synthetic_subject_fixed');
      assert.throws(()=>decodeEnvelope(latest,corrupted),/fingerprint/i);
    } finally {
      await afterRestart.query('ROLLBACK');
    }
    for (const encoding of ['fixed','trimmed','sparse']) {
      const packed=await readVote(afterRestart,'synthetic_subject_'+encoding);
      const data=decodeEnvelope(latest,packed);
      assert.equal(data.synthetic_alpha,'f');
      assert.equal(data.synthetic_beta,'c');
      assert.equal(data.synthetic_gamma,'i');
      assert.equal(data.synthetic_delta,null);
      assert.equal(data[latest.get(3).ids[4]],null);
      const upgraded=upgradeEnvelope(latest,packed);
      assert.deepEqual(decodeEnvelope(latest,upgraded),data);
    }
    console.log('CATALOG_EPHEMERAL_POSTGRES_PASS');
    console.log('CATALOG_EPHEMERAL_RESULT_JSON='+JSON.stringify({
      postgres:17,
      syntheticSubjects:4,
      catalogVersions:latest.versions,
      oldFormats:['fixed','trimmed','sparse'],
      historicalDecode:true,
      reconnectReadback:true,
      serializedConcurrentAppend:{accepted:1,rejectedAsStale:1},
      corruptedCatalogRejected:true,
      corruptedBlobFingerprintRejected:true,
      realSupabaseAccess:false,
      note:'CI-only synthetic proof; no production persistence, RLS, Android or migration'
    }));
  } finally {
    if (second) await second.end();
    await afterRestart.end();
  }
}

main().catch(error=>{
  console.error('Catalog PostgreSQL CI experiment FAILED:',error);
  process.exitCode=1;
});
