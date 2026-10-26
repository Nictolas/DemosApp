'use strict';
/*
 * Isolated PostgreSQL 17 only. Simulates an old restored snapshot whose
 * personal selections precede a later signed, externally held revocation.
 * NEVER accepts a real database URL or Supabase/Render credentials.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { signature, reconcileRestoredPrivacyState } = require('../services/privacyRecoveryGateService');
const DB = 'privacy_recovery_gate_ci';
const SUBJECT = '00000000-0000-4000-8000-000000000301';
const OTHER = '00000000-0000-4000-8000-000000000302';
const THIRD = '00000000-0000-4000-8000-000000000303';
const SECRET = 'synthetic-external-ledger-hmac-key-20261026-long';
const RECOVERY = 'recovery_synthetic_20261026';
function guard() {
  const e=process.env;
  if (e.GITHUB_ACTIONS!=='true'||e.PRIVACY_RECOVERY_CI!=='isolated'||
      e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
      e.PGDATABASE!==DB||e.PGUSER!=='postgres'||e.PGPASSWORD!=='synthetic-only'||
      e.DATABASE_URL||e.SUPABASE_URL||e.SUPABASE_DB_URL||e.SUPABASE_SERVICE_ROLE_KEY||e.RENDER) {
    throw Error('Refusing nonlocal privacy recovery test');
  }
}
const event = (subject, type, time, details = {}) => ({
  event_key: crypto.randomUUID(), subject_user_id: subject,
  event_type: type, occurred_at: time, details
});
function envelope(events, recoveryId=RECOVERY) {
  const payload={formatVersion:1,recoveryId,capturedAt:'2026-10-26T01:00:00.000Z',restoredBackupTakenAt:'2026-10-24T00:00:00.000Z',events};
  return {payload,signature:signature(payload,SECRET)};
}
async function count(db,table,subject) {
  const allowed=['opinioni_risposte','political_selections','user_representatives'];
  assert.ok(allowed.includes(table));
  return Number((await db.query(
    'SELECT count(*)::int AS n FROM "'+table+'" WHERE user_id=$1',[subject]
  )).rows[0].n);
}
async function setup(db) {
  const meta=(await db.query("SELECT current_database() AS n,current_setting('server_version_num')::integer AS v")).rows[0];
  assert.equal(meta.n,DB);
  assert.equal(Math.floor(meta.v/10000),17);
  await db.query('CREATE TABLE users(id uuid PRIMARY KEY,nome text NOT NULL,ruolo text NOT NULL,political_opinions_consent boolean NOT NULL,rappresentante_camera uuid,candidato_comune uuid,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT NOW())');
  await db.query('CREATE TABLE user_consents(user_id uuid PRIMARY KEY,political_opinions_consent boolean,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT NOW())');
  await db.query('CREATE TABLE opinioni_risposte(user_id uuid PRIMARY KEY,energia_nucleare text)');
  await db.query('CREATE TABLE political_selections(user_id uuid NOT NULL,selected_user_id uuid NOT NULL,selection_kind text NOT NULL)');
  await db.query('CREATE TABLE user_representatives(user_id uuid PRIMARY KEY,rappresentante_camera uuid,candidato_comune uuid)');
  for (const [id,label] of [[SUBJECT,'Subject'],[OTHER,'Other'],[THIRD,'Third']]) {
    await db.query('INSERT INTO users(id,nome,ruolo,political_opinions_consent,rappresentante_camera,candidato_comune) VALUES($1,$2,$3,true,$4,$4)',[id,label,'E',OTHER]);
    await db.query('INSERT INTO user_consents(user_id,political_opinions_consent) VALUES($1,true)',[id]);
    await db.query("INSERT INTO opinioni_risposte(user_id,energia_nucleare) VALUES($1,'f')",[id]);
    await db.query('INSERT INTO political_selections(user_id,selected_user_id,selection_kind) VALUES($1,$2,$3)',[id,id===OTHER?SUBJECT:OTHER,'candidate']);
    await db.query('INSERT INTO user_representatives(user_id,rappresentante_camera,candidato_comune) VALUES($1,$2,$2)',[id,OTHER]);
  }
}
async function main() {
  guard();
  const pool=new Pool({host:'127.0.0.1',port:5432,database:DB,user:'postgres',
    password:'synthetic-only',max:2,connectionTimeoutMillis:5000,statement_timeout:15000});
  const db=await pool.connect();
  try {
    await setup(db);
    const events=[
      event(SUBJECT,'political_consent_granted','2026-10-24T12:00:00Z',{original:true}),
      event(SUBJECT,'political_consent_revoked','2026-10-25T12:00:00Z',{reason:'synthetic'}),
      event(OTHER,'political_consent_revoked','2026-10-25T12:00:00Z'),
      event(OTHER,'political_consent_granted','2026-10-26T00:30:00Z')
    ];
    const signed=envelope(events);
    // No maintenance approval means no query and no changes.
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:signed,secret:SECRET,expectedRecoveryId:RECOVERY,maintenanceConfirmed:false
    }),/maintenance/);
    assert.equal(await count(db,'political_selections',SUBJECT),1);
    // Signed payload must exactly match approved session and content.
    const tampered=structuredClone(signed);
    tampered.payload.events[1].subject_user_id=THIRD;
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:tampered,secret:SECRET,expectedRecoveryId:RECOVERY,maintenanceConfirmed:true
    }),/signature invalid/);
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:signed,secret:SECRET,expectedRecoveryId:'wrong_session',maintenanceConfirmed:true
    }),/session/);
    // The signed 2026-10-25 revocation must erase the 2026-10-24 DB snapshot.
    const first=await reconcileRestoredPrivacyState({
      client:db,envelope:signed,secret:SECRET,expectedRecoveryId:RECOVERY,maintenanceConfirmed:true
    });
    assert.equal(first.verifiedExternalEvents,4);
    assert.equal(first.imported,4);
    assert.equal(first.revocationsReapplied,1);
    assert.equal(first.staleSnapshotRevocationsReapplied,2);
    for (const table of ['political_selections','user_representatives','opinioni_risposte']) {
      assert.equal(await count(db,table,SUBJECT),0);
      // Regrant is newer, but the restored backup predates BOTH the revoke
      // and regrant. Old preferences must be erased, not resurrected.
      assert.equal(await count(db,table,OTHER),0);
    }
    const subjectUser=(await db.query('SELECT nome,ruolo,political_opinions_consent,rappresentante_camera,candidato_comune FROM users WHERE id=$1',[SUBJECT])).rows[0];
    assert.equal(subjectUser.nome,'Subject');
    assert.equal(subjectUser.ruolo,'E');
    assert.equal(subjectUser.political_opinions_consent,false);
    assert.equal(subjectUser.rappresentante_camera,null);
    assert.equal(subjectUser.candidato_comune,null);
    assert.equal((await db.query('SELECT political_opinions_consent FROM users WHERE id=$1',[OTHER])).rows[0].political_opinions_consent,true);

    const repeated=await reconcileRestoredPrivacyState({
      client:db,envelope:signed,secret:SECRET,expectedRecoveryId:RECOVERY,maintenanceConfirmed:true
    });
    assert.equal(repeated.imported,0);

    // Even a *validly signed* manifest cannot silently rewrite an event
    // that already exists with the same key and a different subject/type.
    const conflictingEvents=structuredClone(events);
    conflictingEvents[0].details={changed:true};
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:envelope(conflictingEvents),secret:SECRET,
      expectedRecoveryId:RECOVERY,maintenanceConfirmed:true
    }),/conflicts with signed/);

    // A failure after ledger import must rollback the import AND any
    // performed deletions. The operator cannot reopen until retry succeeds.
    const thirdEvent=event(THIRD,'political_consent_revoked','2026-10-25T12:00:00Z');
    const thirdEnvelope=envelope([...events,thirdEvent]);
    const injected={
      async query(sql,params) {
        if (String(sql).startsWith('DELETE FROM "political_selections"')) {
          throw Error('synthetic recovery write failure');
        }
        return db.query(sql,params);
      }
    };
    await assert.rejects(reconcileRestoredPrivacyState({
      client:injected,envelope:thirdEnvelope,secret:SECRET,
      expectedRecoveryId:RECOVERY,maintenanceConfirmed:true
    }),/synthetic recovery write failure/);
    assert.equal(await count(db,'political_selections',THIRD),1);
    assert.equal(Number((await db.query('SELECT count(*)::int AS n FROM privacy_erasure_ledger WHERE event_key=$1',[thirdEvent.event_key])).rows[0].n),0);
    const recovered=await reconcileRestoredPrivacyState({
      client:db,envelope:thirdEnvelope,secret:SECRET,
      expectedRecoveryId:RECOVERY,maintenanceConfirmed:true
    });
    assert.equal(recovered.imported,1);
    assert.equal(await count(db,'political_selections',THIRD),0);
    console.log('PRIVACY_RECOVERY_GATE_PG17_PASS '+JSON.stringify({
      synthetic:true,externalHmacVerified:true,revokeAfterBackup:true,
      regrantDoesNotResurrectOldChoices:true,otherUserDataPreserved:true,idempotent:true,
      replayFailureRolledBack:true,maintenanceRequired:true,
      productionUntouched:true
    }));
  } catch(error) {
    await db.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally {
    db.release();await pool.end();
  }
}
main().catch(err=>{console.error('PRIVACY_RECOVERY_GATE_PG17_FAIL',err);process.exitCode=1;});
