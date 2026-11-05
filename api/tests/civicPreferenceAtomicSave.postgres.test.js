'use strict';

// Only an ephemeral GitHub Actions PostgreSQL 16/17 instance on loopback.
// Uses temporary tables, synthetic IDs, no Firebase, Supabase, Render,
// credentials from external services, or live user data.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {runCivicPreferenceSaveAtomic}=
  require('../services/civicPreferenceAtomicSave');

const DB='postgresql://postgres:civic_ci_only@127.0.0.1:5432/civic_ci';

test('real PG16/17 rolls back consent but persists push guard on uncertain FCM',
  {timeout:20000},async()=>{
  // Reject a non-ephemeral environment before opening any connection.
  assert.equal(process.env.CIVIC_TEST_DATABASE_URL,DB,'EPHEMERAL_DB_ONLY');
  assert.equal(process.env.DATABASE_URL||'','','NO_APPLICATION_DATABASE');
  assert.equal(process.env.CIVIC_STAGING_SESSION_DATABASE_URL||'','','NO_SHARED_STAGING');
  assert.equal(process.env.CIVIC_NEW_INITIATIVE_PUSH_ENABLED||'','','NO_PROVIDER_SEND');
  assert.ok(['16','17'].includes(process.env.CIVIC_CI_POSTGRES_MAJOR),'PG_MATRIX_REQUIRED');

  const db=new Client({connectionString:DB,
    connectionTimeoutMillis:5000,query_timeout:5000});
  await db.connect();
  try {
    const meta=await db.query(
      "SELECT current_database() AS db, current_setting('server_version_num') AS version");
    assert.equal(meta.rows[0].db,'civic_ci');
    assert.equal(Math.floor(Number(meta.rows[0].version)/10000),
      Number(process.env.CIVIC_CI_POSTGRES_MAJOR));

    // Temp schema shadows the real table names only in this CI connection.
    await db.query(`CREATE TEMP TABLE civic_push_delivery_guard (
      id integer PRIMARY KEY, blocked boolean NOT NULL,
      reason_code text, updated_at timestamptz)
      ON COMMIT PRESERVE ROWS`);
    await db.query(`CREATE TEMP TABLE notifiche_preferenze (
      user_id text PRIMARY KEY, eci boolean NOT NULL)
      ON COMMIT PRESERVE ROWS`);
    await db.query(`INSERT INTO civic_push_delivery_guard(id,blocked)
      VALUES(1,FALSE)`);
    await db.query(`INSERT INTO notifiche_preferenze(user_id,eci)
      VALUES('synthetic_canary',TRUE)`);

    await assert.rejects(runCivicPreferenceSaveAtomic(db,async()=>{
      await db.query(`UPDATE notifiche_preferenze SET eci=FALSE
        WHERE user_id='synthetic_canary'`);
      throw new Error('SIMULATED_PROVIDER_UNCERTAIN');
    },{enabled:true}),/CIVIC_PREFERENCE_SAVE_UNCONFIRMED/);

    const afterFail=await db.query(`SELECT p.eci,g.blocked,g.reason_code
      FROM notifiche_preferenze p
      CROSS JOIN civic_push_delivery_guard g
      WHERE p.user_id='synthetic_canary' AND g.id=1`);
    assert.deepEqual(afterFail.rows,[{
      eci:true,blocked:true,reason_code:'REVOCATION_UNCERTAIN',
    }],'rollback must restore consent and guard must survive outside transaction');

    // Success path must commit and must not set a new emergency guard.
    await db.query(`UPDATE civic_push_delivery_guard
      SET blocked=FALSE,reason_code=NULL WHERE id=1`);
    const result=await runCivicPreferenceSaveAtomic(db,async()=>{
      await db.query(`UPDATE notifiche_preferenze SET eci=FALSE
        WHERE user_id='synthetic_canary'`);
      return 'OK';
    },{enabled:true});
    assert.equal(result,'OK');
    const afterSuccess=await db.query(`SELECT p.eci,g.blocked
      FROM notifiche_preferenze p
      CROSS JOIN civic_push_delivery_guard g
      WHERE p.user_id='synthetic_canary' AND g.id=1`);
    assert.deepEqual(afterSuccess.rows,[{eci:false,blocked:false}]);
  } finally {
    await db.end();
  }
});
