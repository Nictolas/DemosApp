'use strict';
// Synthetic-only PostgreSQL 17 test of revocation, rollback, regrant and ledger replay.
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');
const { cleanupConsentScopedPoliticalData } = require('../services/politicalConsentService');
const DB='political_selection_erasure_ci';
const USER='00000000-0000-4000-8000-000000000301';
const OTHER='00000000-0000-4000-8000-000000000302';
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
  await db.query('CREATE TABLE user_consents(user_id uuid PRIMARY KEY,political_opinions_consent boolean,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT NOW())');
  await db.query('CREATE TABLE opinioni_risposte(user_id uuid PRIMARY KEY,energia_nucleare text)');
  await db.query('CREATE TABLE political_selections(user_id uuid NOT NULL,selected_user_id uuid NOT NULL,selection_kind text NOT NULL)');
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
    console.log('POLITICAL_SELECTION_ERASURE_PG17_PASS '+JSON.stringify({fixture:'synthetic',rollback:true,revocation:true,regrantNoResurrection:true,laterGrantPreserved:true,laterRevocationReplay:true,ledgerReplay:true,otherUserSelectionsPreserved:true,candidacyStatusPreserved:true,productionUntouched:true}));
  }catch(error){
    await db.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{db.release();await pool.end();}
}
main().catch(error=>{console.error('POLITICAL_SELECTION_ERASURE_PG17_FAIL',error);process.exitCode=1;});
