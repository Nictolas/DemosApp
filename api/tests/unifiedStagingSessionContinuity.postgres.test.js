'use strict';

// The only permitted database is the ephemeral CI PostgreSQL service on loopback.
// Never connect to Render, Supabase, or a local user's existing database.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {observeReadOnlySessionContinuity}=
  require('../scripts/unifiedStagingSessionContinuity');

const LOCAL='postgresql://postgres:civic_ci_only@127.0.0.1:5432/civic_ci';

test('real PG16/17 session identity persists across read-only transaction boundaries',async()=>{
  assert.equal(process.env.CIVIC_TEST_DATABASE_URL,LOCAL,'CI_EPHEMERAL_DB_ONLY');
  assert.equal(process.env.DATABASE_URL||'','','FORBID_APPLICATION_DB');
  assert.equal(process.env.DEMOS_UNIFIED_STAGING_PREFLIGHT_GO||'','','FORBID_SHARED_STAGING_GO');
  assert.ok(['16','17'].includes(process.env.CIVIC_CI_POSTGRES_MAJOR),'PG_MATRIX_REQUIRED');

  const client=new Client({
    connectionString:LOCAL,connectionTimeoutMillis:5000,query_timeout:5000});
  await client.connect();
  try {
    const identity=await client.query(
      "SELECT current_database() AS db, current_setting('server_version_num') AS version");
    assert.equal(identity.rows[0].db,'civic_ci');
    assert.equal(Math.floor(Number(identity.rows[0].version)/10000),
      Number(process.env.CIVIC_CI_POSTGRES_MAJOR));
    const role=await client.query(
      "SELECT rolpassword IS NULL AS disabled, rolsuper, rolbypassrls, rolinherit FROM pg_catalog.pg_authid WHERE rolname='demos_staging_preflight'");
    assert.deepEqual(role.rows,[{disabled:true,rolsuper:false,rolbypassrls:false,rolinherit:false}]);

    // A disposable role supplied by the P1-P5 synthetic fixture, never cloud.
    // All following transactions remain READ ONLY, including the session probe.
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    await client.query('SET ROLE demos_staging_preflight');
    const safety=await client.query(
      "SELECT current_user AS role, current_setting('default_transaction_read_only') AS readonly");
    assert.deepEqual(safety.rows,[{role:'demos_staging_preflight',readonly:'on'}]);

    assert.equal(await observeReadOnlySessionContinuity(client),true,
      'a single real PG connection must preserve pid and session state');
    // Restore and close; no fixture objects or table rows are modified.
  } finally {
    await client.end();
  }
});

