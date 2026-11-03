'use strict';

// Synthetic-only PostgreSQL scale gate. Refuses shared staging/production.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { selectedRepresentatives, persistLatestForChamber } =
  require('../services/parliamentLatestVoteNotificationsService');
const { sendFinalBallotPush, MAX_RECIPIENTS } =
  require('../services/parliamentFinalBallotPushService');

const dsn = new URL(process.env.TEST_PARLIAMENT_PG_URL || 'postgres://invalid');
if (process.env.TEST_PARLIAMENT_PG_EPHEMERAL !== 'true' ||
    !['127.0.0.1', 'localhost'].includes(dsn.hostname) ||
    dsn.port !== '55432' || dsn.pathname !== '/demos_test' ||
    dsn.username !== 'demos_test') throw new Error('REFUSE_NON_EPHEMERAL_POSTGRES');

const followers = 25000;
const repId = '00000000-0000-4000-8000-999999999999';
const pool = new Pool({ connectionString: dsn.href, max: 3, connectionTimeoutMillis: 5000 });
const previousPush = process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
async function run() {
  try {
    await pool.query([
      'CREATE TABLE users (id uuid PRIMARY KEY, nome text, cognome text, status varchar(10) NOT NULL);',
      'CREATE TABLE political_selections (user_id uuid REFERENCES users(id), selected_user_id uuid REFERENCES users(id), selection_kind text, political_office_id text);',
      // Mirrors the existing canonical index, not a new production migration.
      'CREATE INDEX idx_political_selections_selected_subject ON political_selections(selected_user_id, selection_kind, political_office_id);',
      'CREATE TABLE political_mandates (user_id uuid REFERENCES users(id), status text, office_code text, starts_at timestamptz, ends_at timestamptz);',
      'CREATE TABLE notifiche_preferenze (user_id uuid REFERENCES users(id), deputato boolean, senatore boolean);',
      'CREATE TABLE user_devices (user_id uuid REFERENCES users(id), fcm_token text, is_active boolean);',
      'CREATE TABLE reazioni (comunicazione_id varchar(50), utente_id varchar(50));'
    ].join('\n'));
    const root = path.join(__dirname, '../..');
    await pool.query(fs.readFileSync(path.join(root, 'api/create-notifiche-voti-parlamento-table.sql'), 'utf8'));
    await pool.query(fs.readFileSync(path.join(root, 'api/database/20261103_latest_parliament_votes.sql'), 'utf8'));
    await pool.query("INSERT INTO users (id,nome,cognome,status) VALUES ($1,'Rosa','Bianchi','a')", [repId]);
    await pool.query("INSERT INTO political_mandates (user_id,status,office_code,starts_at) VALUES ($1,'ACTIVE','C',NOW()-INTERVAL '1 day')", [repId]);
    await pool.query(
      "INSERT INTO users (id,nome,cognome,status) " +
      "SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'Test','Follower','a' " +
      'FROM generate_series(1,$1::int) AS n', [followers]);
    await pool.query(
      "INSERT INTO political_selections (user_id,selected_user_id,selection_kind,political_office_id) " +
      "SELECT id,$1::uuid,'representative','it.camera' FROM users WHERE id <> $1::uuid", [repId]);
    await pool.query(
      'INSERT INTO notifiche_preferenze (user_id,deputato,senatore) ' +
      'SELECT id,TRUE,FALSE FROM users WHERE id <> $1::uuid', [repId]);
    await pool.query(
      'INSERT INTO user_devices (user_id,fcm_token,is_active) ' +
      "SELECT id,repeat('F',110)||id::text,TRUE FROM users WHERE id <> $1::uuid", [repId]);
    assert.equal((await pool.query('SELECT count(*)::int n FROM political_selections')).rows[0].n, followers);

    const executed = [];
    const observedPool = {query:async(sql,args)=>{executed.push(sql);return pool.query(sql,args);}};
    const reps = await selectedRepresentatives(observedPool, 'Camera');
    assert.equal(reps.length, 1, '25k followers should select one unique MP');
    assert.match(executed[0], /EXISTS \(SELECT 1 FROM political_selections ps/);
    assert.doesNotMatch(executed[0], /FROM users p JOIN political_selections ps/);
    // Real PG16 query plan, without fragile wall-clock assertions or user data.
    const explain = await pool.query('EXPLAIN (ANALYZE, FORMAT JSON) '+executed[0], ['it.camera','C']);
    const plan = explain.rows[0]['QUERY PLAN'][0];
    assert.equal(plan.Plan['Actual Rows'],1,'PG semijoin must select exactly one MP');
    console.log('SYNTHETIC_SEMIJOIN_QUERY_PASS selected_representatives=1' +
      ' execution_ms=' + Number(plan['Execution Time']).toFixed(2));
    assert.equal(reps[0].id, repId);
    const date = new Date().toISOString().slice(0, 10);
    const vote = {openpolis_id:'vs19_735_017',camera:'Camera',titolo:'Finale sintetica',
      esito:'Approvata',data_votazione:date,
      url_dettaglio:'https://parlamento19.openpolis.it/votazioni/vs19_735_017'};
    const members = Array.from({length:125},(_,i)=>({
      name:i===0?'BIANCHI ROSA':'MEMBRO SINTETICO '+i,
      group:'GRUPPO',vote:i===0?'In missione':'Favorevole'
    }));
    const verified = {voteId:vote.openpolis_id,chamber:vote.camera,date,
      source:{type:'official',url:'https://documenti.camera.it/fixture'},members};
    const first = await persistLatestForChamber(pool,vote,verified,reps);
    const replay = await persistLatestForChamber(pool,vote,verified,reps);
    assert.equal(first.changed,1);
    assert.equal(replay.changed,0,'deduplication of source replay');
    const rows = (await pool.query('SELECT id_utente,camera,voto,openpolis_id FROM notifiche_voti_parlamento')).rows;
    assert.equal(rows.length,1,'no per-follower notification writes');
    assert.equal(rows[0].openpolis_id,vote.openpolis_id);
    assert.equal(rows[0].voto,'In missione','absence is not a contrary vote');

    // Even a mistakenly enabled transport cannot deliver a 25k-token burst.
    process.env.PARLIAMENT_FINAL_PUSH_ENABLED = 'true';
    let networkCalls=0;
    const mockAdmin={messaging:()=>({sendEach:async()=>{networkCalls++;throw Error('NO_SEND_ALLOWED')}})};
    const result=await sendFinalBallotPush(pool,{representativeId:repId,
      chamber:'Camera',openpolisId:vote.openpolis_id,title:vote.titolo,
      status:'In missione'},{firebaseAdmin:mockAdmin});
    assert.equal(MAX_RECIPIENTS,5000);
    assert.equal(result.capacityGate,true);
    assert.equal(result.sent,0);
    assert.equal(networkCalls,0);
    assert.equal((await pool.query('SELECT count(*)::int n FROM notifiche_voti_parlamento')).rows[0].n,1);
    // Only a currently ACTIVE follower makes the parliamentary selection eligible.
    // Update synthetic accounts only, after the FCM capacity test.
    await pool.query("UPDATE users SET status='i' WHERE id <> $1::uuid", [repId]);
    assert.deepEqual(await selectedRepresentatives(pool,'Camera'),[],
      'revoked/inactive follower selection must not surface an MP');
    assert.deepEqual(await selectedRepresentatives(pool,'Senato'),[],
      'the other chamber must remain empty');
    console.log('SYNTHETIC_SCALE_PASS followers=25000 shared_rows=1 replay=0 push_attempts=0 cap=5000');
    console.log('25k synthetic PostgreSQL rows do not establish a one-million-user SLA.');
  } finally {
    if(previousPush===undefined) delete process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
    else process.env.PARLIAMENT_FINAL_PUSH_ENABLED=previousPush;
    await pool.end();
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
