'use strict';
// Real PostgreSQL 16/17 ONLY on disposable CI localhost, with TEMP tables.
// Never accesses Render, Supabase, Firebase or actual users.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {getLegacyTokens,updateLegacyTokens}=
  require('../services/civicLegacyFcmStorage');
const DSN='postgresql://postgres:civic_ci_only@127.0.0.1:5432/civic_ci';

test('retiring users.fcm_tokens never aborts FCM device mutations', {timeout:20000}, async()=>{
  assert.equal(process.env.CIVIC_TEST_DATABASE_URL,DSN,'EPHEMERAL_ONLY');
  assert.equal(process.env.DATABASE_URL||'','','NO_APP_DB');
  assert.equal(process.env.CIVIC_STAGING_SESSION_DATABASE_URL||'','','NO_STAGING');
  assert.equal(process.env.CIVIC_NEW_INITIATIVE_PUSH_ENABLED||'','','NO_REAL_FCM');
  assert.ok(['16','17'].includes(process.env.CIVIC_CI_POSTGRES_MAJOR),'PG_MATRIX');
  const db=new Client({connectionString:DSN,connectionTimeoutMillis:5000,query_timeout:5000});
  await db.connect();
  try{
    const metadata=await db.query(
      "SELECT current_database() AS db,current_setting('server_version_num') AS version");
    assert.equal(metadata.rows[0].db,'civic_ci');
    assert.equal(Math.floor(Number(metadata.rows[0].version)/10000),
      Number(process.env.CIVIC_CI_POSTGRES_MAJOR));
    await db.query(`CREATE TEMP TABLE users (
      id text PRIMARY KEY,updated_at timestamptz DEFAULT NOW()
    ) ON COMMIT PRESERVE ROWS`);
    await db.query(`CREATE TEMP TABLE user_devices (
      user_id text NOT NULL,fcm_token text PRIMARY KEY,is_active boolean NOT NULL
    ) ON COMMIT PRESERVE ROWS`);
    await db.query("INSERT INTO pg_temp.users(id) VALUES('synthetic_account')");
    await db.query('BEGIN');
    const state=await getLegacyTokens('synthetic_account',db);
    assert.deepEqual(state,{tokens:[],hasColumn:false});
    assert.equal(await updateLegacyTokens('synthetic_account',[],db,state.hasColumn),false);
    await db.query(
      "INSERT INTO pg_temp.user_devices(user_id,fcm_token,is_active) VALUES('synthetic_account','fake-fcm-token',true)");
    await db.query('COMMIT');
    const devices=await db.query("SELECT is_active FROM pg_temp.user_devices WHERE user_id='synthetic_account'");
    assert.deepEqual(devices.rows,[{is_active:true}],
      'canonical device registration must commit without missing legacy column');
    await db.query('ALTER TABLE pg_temp.users ADD COLUMN fcm_tokens text[]');
    await db.query('BEGIN');
    const presentNull=await getLegacyTokens('synthetic_account',db);
    assert.deepEqual(presentNull,{tokens:[],hasColumn:true},
      'SQL NULL array must be treated as empty, not invalid JSON');
    assert.equal(await updateLegacyTokens(
      'synthetic_account',['synthetic-token-1'],db,presentNull.hasColumn),true);
    await db.query('COMMIT');
    assert.deepEqual(await getLegacyTokens('synthetic_account',db),
      {tokens:['synthetic-token-1'],hasColumn:true});
  }finally{
    await db.end();
  }
});
