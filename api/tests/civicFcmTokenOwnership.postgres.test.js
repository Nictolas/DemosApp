'use strict';

// Real PostgreSQL16/17 integration against a disposable CI-only loopback DB.
// Never reads or writes user/FCM data in Supabase, Render or production.
const test = require('node:test');
const assert = require('node:assert/strict');
const {Client} = require('pg');
const {onlyTokensNotOwnedByOthers,onlyTokensNotRegisteredToOthers,
  upsertCleanupOwnedOrUnassignedToken,getActiveCivicUserDeviceTokens,
  getSupersededCivicTokens} =
  require('../services/civicFcmTokenOwnership');

const LOOPBACK = 'postgresql://postgres:civic_ci_only@127.0.0.1:5432/civic_ci';

test('real PG16/17 never revokes a legacy token owned by another active account',
  {timeout:20000},async()=>{
  // Prove the exact disposable CI configuration BEFORE any connection.
  assert.equal(process.env.CIVIC_TEST_DATABASE_URL, LOOPBACK, 'CI_EPHEMERAL_ONLY');
  assert.equal(process.env.DATABASE_URL || '', '', 'FORBID_APP_DATABASE');
  assert.equal(process.env.CIVIC_STAGING_SESSION_DATABASE_URL || '', '', 'NO_STAGING_CONNECTION');
  assert.equal(process.env.CIVIC_NEW_INITIATIVE_PUSH_ENABLED || '', '', 'NO_FCM');
  assert.ok(['16','17'].includes(process.env.CIVIC_CI_POSTGRES_MAJOR), 'PG_MATRIX_REQUIRED');

  const client = new Client({
    connectionString: LOOPBACK,connectionTimeoutMillis:5000,query_timeout:5000});
  await client.connect();
  try {
    const metadata=await client.query(
      "SELECT current_database() AS db, current_setting('server_version_num') AS version");
    assert.equal(metadata.rows[0].db,'civic_ci');
    assert.equal(Math.floor(Number(metadata.rows[0].version)/10000),
      Number(process.env.CIVIC_CI_POSTGRES_MAJOR));

    // Temporary table shadows the name only in THIS session. It disappears
    // on disconnect, and never affects seeded public fixture tables.
    await client.query(
      'CREATE TEMP TABLE user_devices (fcm_token text PRIMARY KEY, user_id text NOT NULL, is_active boolean NOT NULL, last_seen_at timestamptz, created_at timestamptz, updated_at timestamptz) ON COMMIT PRESERVE ROWS');
    await client.query(
      "INSERT INTO pg_temp.user_devices(fcm_token,user_id,is_active) VALUES"+
      "('token_reassigned','new_account',true),"+
      "('token_original','old_account',true),"+
      "('token_inactive','new_account',false)");

    const oldOwner=await onlyTokensNotOwnedByOthers(client,'old_account',[
      'token_reassigned','token_original','token_inactive','token_missing','token_reassigned']);
    assert.deepEqual(oldOwner,[
      'token_original','token_missing'],
      'legacy owner must not revoke an active OR inactive reassigned token');

    const transferTokens=await getSupersededCivicTokens(client,'old_account','token_inactive');
    assert.deepEqual([...transferTokens].sort(),['token_inactive','token_original'],
      'transfer requires unsubscribe even when prior owner device is inactive');
    assert.deepEqual(await onlyTokensNotOwnedByOthers(client,'old_account',[
      'token_inactive','token_original']),['token_original']);

    const currentOwner=await onlyTokensNotOwnedByOthers(
      client,'new_account',['token_reassigned','token_original']);
    assert.deepEqual(currentOwner,['token_reassigned'],
      'current owner can revoke its own token, not the previous owner token');

    // Simulate another account transition and verify that the authoritative
    // active owner determines revocation rights, not stale legacy metadata.
    await client.query(
      "UPDATE pg_temp.user_devices SET user_id='third_account' WHERE fcm_token='token_reassigned'");
    assert.deepEqual(await onlyTokensNotOwnedByOthers(
      client,'new_account',['token_reassigned']),[]);
    assert.deepEqual(await onlyTokensNotOwnedByOthers(
      client,'third_account',['token_reassigned']),['token_reassigned']);
    // Cleanup and all other revocations protect both active and inactive
    // foreign registrations. Neither may reclaim the foreign token.
    assert.deepEqual(await onlyTokensNotRegisteredToOthers(
      client,'old_account',['token_original','token_reassigned','token_inactive','brand_new']),
      ['token_original','brand_new']);

    // Filtered stale legacy data cannot steal another account's active or
    // inactive token, even if it races between filter and SQL UPSERT.
    await assert.rejects(upsertCleanupOwnedOrUnassignedToken(
      client,'old_account','token_reassigned'),
      /CIVIC_FCM_CLEANUP_OWNERSHIP_UNCONFIRMED/);
    await assert.rejects(upsertCleanupOwnedOrUnassignedToken(
      client,'old_account','token_inactive'),
      /CIVIC_FCM_CLEANUP_OWNERSHIP_UNCONFIRMED/);
    const owners=await client.query(
      "SELECT fcm_token,user_id,is_active FROM user_devices WHERE fcm_token IN ('token_reassigned','token_inactive') ORDER BY fcm_token");
    assert.deepEqual(owners.rows,[
      {fcm_token:'token_inactive',user_id:'new_account',is_active:false},
      {fcm_token:'token_reassigned',user_id:'third_account',is_active:true},
    ]);
    await upsertCleanupOwnedOrUnassignedToken(client,'old_account','token_original');
    await upsertCleanupOwnedOrUnassignedToken(client,'old_account','brand_new');
    assert.deepEqual((await client.query(
      "SELECT fcm_token FROM user_devices WHERE user_id='old_account' ORDER BY fcm_token"))
      .rows.map(row=>row.fcm_token),['brand_new','token_original']);

    // A stale/empty legacy list must not cause the canonical ACTIVE token to
    // be deactivated: newest device is the authoritative survivor.
    await client.query(
      "UPDATE pg_temp.user_devices SET updated_at='2026-01-01T00:00:00Z' WHERE fcm_token='token_original'");
    await client.query(
      "UPDATE pg_temp.user_devices SET updated_at='2026-02-01T00:00:00Z' WHERE fcm_token='brand_new'");
    await client.query(
      "INSERT INTO pg_temp.user_devices (fcm_token,user_id,is_active,updated_at) VALUES"+
      "('inactive_old','old_account',false,'2026-03-01T00:00:00Z')");
    assert.deepEqual(await getActiveCivicUserDeviceTokens(client,'old_account'),
      ['brand_new','token_original'],
      'canonical newer active token must be first; inactive and foreign excluded');
    assert.deepEqual(await getActiveCivicUserDeviceTokens(client,'new_account'),[],
      'foreign inactive device is never included in old account selection');
  } finally {
    await client.end();
  }
});
