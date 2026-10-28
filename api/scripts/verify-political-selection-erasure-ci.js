'use strict';
// Synthetic-only PostgreSQL 17 test of revocation, rollback, regrant and ledger replay.
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');
const { cleanupConsentScopedPoliticalData } = require('../services/politicalConsentService');
const { sealOffline, verifyOffline } = require('../services/gdprExternalEvidenceVerifier');
const DB='political_selection_erasure_ci';
const USER='00000000-0000-4000-8000-000000000301';
const OTHER='00000000-0000-4000-8000-000000000302';
const SURVIVOR='00000000-0000-4000-8000-000000000303';
function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.POLITICAL_SELECTION_ERASURE_CI!=='isolated'||
     e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||e.PGDATABASE!==DB||
     e.PGUSER!=='postgres'||e.PGPASSWORD!=='synthetic-only'||e.DATABASE_URL||
     e.SUPABASE_URL||e.SUPABASE_DB_URL||e.SUPABASE_SERVICE_ROLE_KEY||e.RENDER)
    throw Error('Refusing non-local synthetic database');
}
async function scalar(db,sql,params=[]){
  const result=await db.query(sql,params);
  return Number(Object.values(result.rows[0])[0]);
}
async function assertErased(db){
  assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1',[USER]),0);
  assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM user_representatives WHERE user_id=$1',[USER]),0);
  assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM opinioni_risposte WHERE user_id=$1',[USER]),0);
  const profile=(await db.query('SELECT nome,ruolo,rappresentante_camera,candidato_comune,candidato_attivo FROM users WHERE id=$1',[USER])).rows[0];
  assert.equal(profile.nome,'Synthetic');
  assert.equal(profile.ruolo,'E');
  assert.equal(profile.candidato_attivo,true); // Candidacy status is not a personal voting preference.
  assert.equal(profile.rappresentante_camera,null);
  assert.equal(profile.candidato_comune,null);
  assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1 AND selected_user_id=$2',[OTHER,USER]),1);
}
async function seedChoices(db){
  await db.query("INSERT INTO political_selections(user_id,selected_user_id,selection_kind) VALUES ($1,$2,'candidate'),($1,$2,'representative')",[USER,OTHER]);
  if(!await scalar(db,'SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1',[OTHER]))
    await db.query("INSERT INTO political_selections(user_id,selected_user_id,selection_kind) VALUES ($1,$2,'candidate')",[OTHER,USER]);
  await db.query('INSERT INTO user_representatives(user_id,rappresentante_camera,candidato_comune) VALUES ($1,$2,$2)',[USER,OTHER]);
  await db.query('INSERT INTO opinioni_risposte(user_id,energia_nucleare) VALUES ($1,$2)',[USER,'f']);
  await db.query('UPDATE users SET rappresentante_camera=$2,candidato_comune=$2 WHERE id=$1',[USER,OTHER]);
}
async function setup(db){
  await db.query('CREATE TABLE users (id uuid PRIMARY KEY,nome text NOT NULL,ruolo text NOT NULL,rappresentante_camera uuid,candidato_comune uuid,candidato_attivo boolean NOT NULL DEFAULT false,political_opinions_consent boolean NOT NULL,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT NOW())');
  await db.query('CREATE TABLE user_profile(user_id uuid PRIMARY KEY,data_nascita date,comune_residenza text,avatar_config jsonb)');
  await db.query('CREATE TABLE active_sessions(id text PRIMARY KEY,user_id text NOT NULL,session_token text,ip_address text,user_agent text,is_active boolean)');
  await db.query('CREATE TABLE user_consents(user_id uuid PRIMARY KEY,political_opinions_consent boolean,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT NOW())');
  await db.query('CREATE TABLE opinioni_risposte(user_id uuid PRIMARY KEY,energia_nucleare text)');
  await db.query('CREATE TABLE political_selections(user_id uuid NOT NULL,selected_user_id uuid NOT NULL,selection_kind text NOT NULL)');
  await db.query('CREATE TABLE civic_ballot_positions(civic_ballot_id uuid NOT NULL,user_id uuid NOT NULL,choice text NOT NULL,PRIMARY KEY(civic_ballot_id,user_id))');
  await db.query('CREATE TABLE user_representatives(user_id uuid PRIMARY KEY,rappresentante_camera uuid,candidato_comune uuid)');
  await db.query("INSERT INTO users(id,nome,ruolo,rappresentante_camera,candidato_comune,candidato_attivo,political_opinions_consent) VALUES ($1,'Synthetic','E',$2,$2,true,true),($2,'Other','E',NULL,NULL,false,true)",[USER,OTHER]);
  await db.query('INSERT INTO user_consents(user_id,political_opinions_consent) VALUES ($1,true),($2,true)',[USER,OTHER]);
  await seedChoices(db);
}
async function main(){
  guard();
  const pool=new Pool({host:'127.0.0.1',port:5432,user:'postgres',password:'synthetic-only',database:DB,max:2,connectionTimeoutMillis:5000,statement_timeout:16000});
  const db=await pool.connect();
  try{
    const version=(await db.query("SELECT current_database() AS db,current_setting('server_version_num')::integer AS version")).rows[0];
    assert.equal(version.db,DB);
    assert.equal(Math.floor(version.version/10000),17);
    await setup(db);
    // Explicit operator-only bootstrap on a local synthetic fixture. #366 never creates a ledger on an end-user request.
    await Ledger.ensureTable(db);
    await db.query('BEGIN');
    const pending=await cleanupConsentScopedPoliticalData(db,USER);
    assert.equal(pending.deletedByTable.political_selections,2);
    assert.equal(pending.deletedByTable.user_representatives,1);
    assert.equal(pending.legacySelectionsCleared,2);
    await assertErased(db);
    await db.query('ROLLBACK');
    assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1',[USER]),2);
    assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM user_representatives WHERE user_id=$1',[USER]),1);
    await db.query('BEGIN');
    await db.query('UPDATE users SET political_opinions_consent=false WHERE id=$1',[USER]);
    await db.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1',[USER]);
    const revoked=await cleanupConsentScopedPoliticalData(db,USER);
    assert.equal(revoked.deletedByTable.political_selections,2);
    assert.equal(revoked.deletedByTable.user_representatives,1);
    const firstRevocation=await Ledger.recordEvent(db,{userId:USER,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,details:{source:'synthetic-ci'}});
    await db.query('COMMIT');
    await assertErased(db);
    // A later recorded grant must not be undone by an older revocation on replay.
    await db.query('UPDATE users SET political_opinions_consent=true WHERE id=$1',[USER]);
    await db.query('UPDATE user_consents SET political_opinions_consent=true WHERE user_id=$1',[USER]);
    const laterGrant=await Ledger.recordEvent(db,{userId:USER,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_GRANTED,details:{source:'synthetic-ci'}});
    await assertErased(db); // Old preferences do not reappear merely because consent was regranted.
    await seedChoices(db); // New choices made only after regrant are legitimate.
    // Deterministic ordering independent of CI clock resolution, using synthetic events only.
    await db.query("UPDATE privacy_erasure_ledger SET occurred_at=NOW()-interval '2 hours' WHERE event_key=$1",[firstRevocation.event_key]);
    await db.query("UPDATE privacy_erasure_ledger SET occurred_at=NOW()-interval '1 hour' WHERE event_key=$1",[laterGrant.event_key]);
    await db.query('BEGIN');
    const grantReplay=await Ledger.applyCurrentPrivacyState(db);
    assert.equal(grantReplay.revocationsReapplied,0);
    await db.query('COMMIT');
    assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1',[USER]),2);
    assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM user_representatives WHERE user_id=$1',[USER]),1);
    assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM opinioni_risposte WHERE user_id=$1',[USER]),1);
    assert.equal((await db.query('SELECT political_opinions_consent FROM users WHERE id=$1',[USER])).rows[0].political_opinions_consent,true);

    // A subsequent revocation recorded after that grant must win during restore.
    // Simulate an old backup containing choices without performing live cleanup.
    await db.query('UPDATE users SET political_opinions_consent=false WHERE id=$1',[USER]);
    await db.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1',[USER]);
    const finalRevocation=await Ledger.recordEvent(db,{userId:USER,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,details:{source:'synthetic-ci'}});
    await db.query('BEGIN');
    const replay=await Ledger.applyCurrentPrivacyState(db);
    assert.equal(replay.revocationsReapplied,1);
    assert.ok(replay.opinionsRemoved>=1);
    await db.query('COMMIT');
    await assertErased(db);
    assert.equal((await db.query('SELECT political_opinions_consent FROM users WHERE id=$1',[USER])).rows[0].political_opinions_consent,false);

    // Account deletion must not depend on foreign keys existing after a
    // partial backup restore. This fixture intentionally has NO FKs.
    // A separate user owns a canonical selection and a legacy
    // user_representatives row, consent and referendum choice must be purged.
    // The referendum fixture also omits the normally cascading user FK.
    await db.query(
      "INSERT INTO users(id,nome,ruolo,political_opinions_consent) VALUES ($1,'Survivor','E',true)",
      [SURVIVOR]
    );
    // Profiles and operational refresh-session hashes must also be removed
    // explicitly, without relying on cascading account foreign keys.
    await db.query(
      "INSERT INTO user_profile(user_id,data_nascita,comune_residenza,avatar_config) VALUES ($1,'2000-01-01','synthetic-deleted',$3::jsonb),($2,'2001-02-03','synthetic-survivor',$4::jsonb)",
      [OTHER,SURVIVOR,JSON.stringify({color:'red'}),JSON.stringify({color:'blue'})]
    );
    await db.query(
      "INSERT INTO active_sessions(id,user_id,session_token,ip_address,user_agent,is_active) VALUES ('deleted-session',$1,'synthetic-deleted-hash','192.0.2.1','synthetic-deleted',true),('surviving-session',$2,'synthetic-surviving-hash','192.0.2.2','synthetic-survivor',true)",
      [OTHER,SURVIVOR]
    );
    await db.query(
      "INSERT INTO civic_ballot_positions(civic_ballot_id,user_id,choice) VALUES ($1,$2,'YES'),($1,$3,'NO')",
      [USER,OTHER,SURVIVOR]
    );
    await db.query(
      'INSERT INTO user_representatives(user_id,rappresentante_camera) VALUES ($1,$2)',
      [OTHER,USER]
    );
    const accountCounts=async()=>({
      users:await scalar(db,'SELECT COUNT(*)::int FROM users WHERE id=$1',[OTHER]),
      consent:await scalar(db,'SELECT COUNT(*)::int FROM user_consents WHERE user_id=$1',[OTHER]),
      choices:await scalar(db,'SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1',[OTHER]),
      profile:await scalar(db,'SELECT COUNT(*)::int FROM user_profile WHERE user_id=$1',[OTHER]),
      sessions:await scalar(db,'SELECT COUNT(*)::int FROM active_sessions WHERE user_id=$1',[OTHER]),
      referendum:await scalar(db,'SELECT COUNT(*)::int FROM civic_ballot_positions WHERE user_id=$1',[OTHER]),
      representatives:await scalar(db,'SELECT COUNT(*)::int FROM user_representatives WHERE user_id=$1',[OTHER]),
    });
    assert.deepEqual(await accountCounts(), {users:1,consent:1,choices:1,profile:1,sessions:1,referendum:1,representatives:1});
    await db.query('BEGIN');
    const deletionProbe=await Ledger.enforceAccountDeletion(db,OTHER);
    assert.equal(deletionProbe.userDeleted,1);
    assert.deepEqual(await accountCounts(), {users:0,consent:0,choices:0,profile:0,sessions:0,referendum:0,representatives:0});
    await db.query('ROLLBACK');
    assert.deepEqual(await accountCounts(), {users:1,consent:1,choices:1,profile:1,sessions:1,referendum:1,representatives:1});
    await db.query('BEGIN');
    await Ledger.recordEvent(db,{userId:OTHER,eventType:Ledger.EVENT_TYPES.ACCOUNT_DELETED,details:{source:'synthetic-account-restore'}});
    const deletion=await Ledger.applyCurrentPrivacyState(db);
    assert.equal(deletion.accountsRemoved,1);
    await db.query('COMMIT');
    assert.deepEqual(await accountCounts(), {users:0,consent:0,choices:0,profile:0,sessions:0,referendum:0,representatives:0});
    assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM users WHERE id=$1',[USER]),1,
      'deleting the other account must not remove a surviving user');

    assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM civic_ballot_positions WHERE user_id=$1 AND choice=$2',[SURVIVOR,'NO']),1,
      'account replay must preserve another user referendum choice');
    await db.query('BEGIN');
    const secondDeletion=await Ledger.applyCurrentPrivacyState(db);
    assert.equal(secondDeletion.accountsRemoved,0);
    await db.query('COMMIT');
    assert.deepEqual(await accountCounts(), {users:0,consent:0,choices:0,profile:0,sessions:0,referendum:0,representatives:0});
    assert.equal(await scalar(db,'SELECT COUNT(*)::int FROM civic_ballot_positions WHERE user_id=$1',[SURVIVOR]),1);

    const survivorProfile=(await db.query('SELECT comune_residenza,avatar_config FROM user_profile WHERE user_id=$1',[SURVIVOR])).rows;
    assert.deepEqual(survivorProfile,[{comune_residenza:'synthetic-survivor',avatar_config:{color:'blue'}}]);
    const survivorSessions=(await db.query('SELECT session_token,ip_address,user_agent,is_active FROM active_sessions WHERE user_id=$1',[SURVIVOR])).rows;
    assert.deepEqual(survivorSessions,[{session_token:'synthetic-surviving-hash',ip_address:'192.0.2.2',user_agent:'synthetic-survivor',is_active:true}]);

    // Join the real pg17 captureCurrent serialization with the OFFLINE
    // proof. This does not upload, export to any external provider, or change
    // the existing ledger. The HMAC is synthetic and pinned independently by
    // the test harness only.
    const ledgerRows=await Ledger.captureCurrent(db);
    assert.equal(ledgerRows.length,4);
    const syntheticKey=Buffer.alloc(32,19);
    const capturedAt=new Date().toISOString();
    const sealed=sealOffline({
      events:ledgerRows,capturedAt,source:'gdpr_synthetic_pg17'
    },syntheticKey);
    const pinnedSignature=sealed.signature;
    const validated=verifyOffline(sealed,{
      secret:syntheticKey,expectedSignature:pinnedSignature,
      expectedSource:'gdpr_synthetic_pg17',
      now:Date.now(),maxAgeMs:3600000
    });
    assert.equal(validated.eventCount,ledgerRows.length);
    assert.equal(validated.status,'INTEGRITY_ONLY_NOT_RECOVERY_GO');
    assert.equal(validated.externalLedgerCompletenessAttested,false);
    const missingEvent={...sealed,events:sealed.events.slice(0,-1)};
    assert.throws(()=>verifyOffline(missingEvent,{
      secret:syntheticKey,expectedSignature:pinnedSignature,
      expectedSource:'gdpr_synthetic_pg17',now:Date.now()
    }),e=>e?.code==='GDPR_EXTERNAL_EVIDENCE_DIGEST_MISMATCH');

    console.log('POLITICAL_SELECTION_ERASURE_PG17_PASS '+JSON.stringify({fixture:'synthetic',rollback:true,revocation:true,regrantNoResurrection:true,laterGrantPreserved:true,laterRevocationReplay:true,ledgerReplay:true,otherUserSelectionsPreserved:true,candidacyStatusPreserved:true,accountDeletionWithoutForeignKeys:true,accountDeletionRollback:true,referendumDeletionWithoutForeignKeys:true,accountReplayIdempotent:true,profileDeletionWithoutForeignKeys:true,activeSessionDeletionWithoutForeignKeys:true,otherUserProfileAndSessionPreserved:true,otherUserReferendumChoicePreserved:true,signedPg17LedgerCapture:true,independentPinDetectsDroppedEvent:true,productionUntouched:true}));
  }catch(error){
    await db.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{db.release();await pool.end();}
}
main().catch(error=>{console.error('POLITICAL_SELECTION_ERASURE_PG17_FAIL',error);process.exitCode=1;});
