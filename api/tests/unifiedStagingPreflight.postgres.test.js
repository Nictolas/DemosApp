'use strict';

// OPS-STG-001: real, verbatim preflight SQL against disposable PostgreSQL 16/17.
// NO network to Supabase/Render, NO secrets, NO shared staging, NO release GO.
// CI admin connection is ONLY used to SET LOCAL ROLE; queries then execute
// with the permissions of the real, passwordless preflight PostgreSQL role.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {Client} = require('pg');
const gate = require('../scripts/unifiedStagingPreflight');

const LOCAL = 'postgresql://postgres:civic_ci_only@127.0.0.1:5432/civic_ci';
const SYNTHETIC_ID = '00000000-0000-4000-8000-00000000cafe';
const source = fs.readFileSync(path.join(__dirname,'..','scripts','unifiedStagingPreflight.js'),'utf8');

function actualPreflightSQL(variableName) {
  const marker = 'const ' + variableName + ' = await client.query(';
  const begin = source.indexOf(marker);
  assert.ok(begin >= 0, 'missing real preflight query: ' + variableName);
  assert.equal(source.indexOf(marker, begin+marker.length), -1,
    'ambiguous duplicate preflight query: ' + variableName);
  const quote = String.fromCharCode(96);
  const start = source.indexOf(quote, begin+marker.length);
  const end = source.indexOf(quote, start+1);
  assert.ok(start >= 0 && end > start, 'missing template query for: '+variableName);
  return source.slice(start+1,end);
}

test('actual preflight SQL runs as least-privilege role; no schema GO or write access', async () => {
  assert.equal(process.env.CIVIC_TEST_DATABASE_URL,LOCAL,'DISALLOW_REMOTE_TEST_DB');
  assert.equal(process.env.DATABASE_URL || '', '', 'DISALLOW_APP_DB');
  assert.equal(process.env.DEMOS_UNIFIED_STAGING_PREFLIGHT_GO || '', '', 'DISALLOW_SHARED_STAGING_GO');
  const major = Number(process.env.CIVIC_CI_POSTGRES_MAJOR);
  assert.ok([16,17].includes(major),'EXPECTED_POSTGRES_MATRIX');
  const client = new Client({connectionString:LOCAL,connectionTimeoutMillis:5000});
  await client.connect();
  let inTransaction=false;
  try {
    const version = await client.query('SHOW server_version_num');
    assert.equal(Math.floor(Number(version.rows[0].server_version_num)/10000),major);
    const admin = await client.query("SELECT rolpassword IS NULL AS disabled FROM pg_catalog.pg_authid WHERE rolname='demos_staging_preflight'");
    assert.deepEqual(admin.rows,[{disabled:true}], 'preflight role must not have a password');
    const db = await client.query('SELECT current_database() AS db');
    assert.equal(db.rows[0].db,'civic_ci');
    await client.query('BEGIN READ ONLY');
    inTransaction=true;
    await client.query('SET LOCAL ROLE demos_staging_runtime');
    const wrongRole = await client.query(actualPreflightSQL('roleCheck'));
    assert.equal(gate.evaluatePreflightRole(wrongRole.rows),false,
      'application role must never be accepted as preflight role');

    await client.query('SET LOCAL ROLE demos_staging_preflight');
    const role = await client.query(actualPreflightSQL('roleCheck'));
    assert.equal(gate.evaluatePreflightRole(role.rows),true,
      'real SQL must accept only the specifically provisioned restricted role');
    const writes = await client.query(actualPreflightSQL('writeCheck'));
    assert.equal(gate.evaluatePreflightWriteGrants(writes.rows),true,
      'real catalog query must find no table, column or sequence write privileges');

    const identitySql = 'SELECT md5(db_identity::text) AS identity_hash FROM public.civic_runtime_identity WHERE id = 1';
    assert.ok(source.includes(identitySql),'production identity query changed without updating test');
    const identity = await client.query(identitySql);
    assert.deepEqual(identity.rows,[{
      identity_hash:createHash('md5').update(SYNTHETIC_ID).digest('hex')
    }], 'only the synthetic CI database identity may be read');

    const tables = await client.query(actualPreflightSQL('tables'),
      ['public',[...gate.REQUIRED_TABLES]]);
    const schema = gate.evaluateSchema(tables.rows.map(row=>row.table_name));
    assert.equal(schema.ready,false,'minimal CI fixture must never indicate complete application schema');
    assert.ok(schema.missing.includes('user_consents'));

    const protection = await client.query(actualPreflightSQL('protectionRows'),['public']);
    assert.equal(gate.evaluateAllPublicStagingTables(protection.rows).ready,false,
      'incomplete synthetic CI fixture must not be mistaken for safe real staging');
    assert.equal(gate.evaluateCivicProtection(protection.rows).ready,false,
      'missing CI private tables must fail closed');
    const sequences = await client.query(actualPreflightSQL('publicSequenceRows'));
    assert.equal(gate.evaluatePublicSequenceProtection(sequences.rows).ready,true);
    const columnTables = [...new Set(gate.CIVIC_RUNTIME_COLUMNS.map(([table])=>table))];
    const columns = await client.query(actualPreflightSQL('columnRows'),
      ['public',columnTables]);
    assert.equal(gate.evaluateCivicRuntimeColumns(columns.rows).ready,false,
      'CI fixture intentionally lacks full runtime schema');

    const guardSql = 'SELECT blocked FROM public.civic_push_delivery_guard WHERE id = 1';
    assert.ok(source.includes(guardSql),'production push guard query changed without updating test');
    const guard = await client.query(guardSql);
    assert.equal(gate.evaluateBlockedGuard(guard.rows),true);

    await client.query('SAVEPOINT forbidden_profile_read');
    await assert.rejects(client.query('SELECT count(*) FROM public.users'),
      err=>err.code==='42501','preflight role must not read users');
    await client.query('ROLLBACK TO SAVEPOINT forbidden_profile_read');
    await client.query('ROLLBACK');
    inTransaction=false;

    // Verify the write privilege itself, not only read-only transaction mode.
    await client.query('BEGIN');
    inTransaction=true;
    await client.query('SET LOCAL ROLE demos_staging_preflight');
    await client.query('SAVEPOINT forbidden_guard_update');
    await assert.rejects(
      client.query('UPDATE public.civic_push_delivery_guard SET blocked=FALSE WHERE id=1'),
      err=>err.code==='42501','preflight role must have no guard UPDATE privilege'
    );
    await client.query('ROLLBACK TO SAVEPOINT forbidden_guard_update');
    await client.query('ROLLBACK');
    inTransaction=false;
  } finally {
    if(inTransaction) await client.query('ROLLBACK');
    try {
      const counts = await client.query("SELECT (SELECT count(*)::int FROM public.users) AS users,"+" (SELECT count(*)::int FROM public.civic_ballot_positions) AS ballots,"+" (SELECT count(*)::int FROM public.civic_ballot_forecast_snapshots) AS snapshots,"+" (SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1) AS blocked");
      assert.deepEqual(counts.rows,[{users:2,ballots:0,snapshots:0,blocked:true}]);
    } finally {
      await client.end();
    }
  }
});
