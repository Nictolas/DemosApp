'use strict';

// REAL PostgreSQL 16 integration; GitHub Actions ephemeral service ONLY.
// Never pointed at Supabase, production or shared staging.
// Requires explicit ephemeral flag and the exact localhost test DSN.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const {
  LATEST_FINAL_BALLOTS_SQL, selectedRepresentatives, persistLatestForChamber, refreshLatestParliamentVoteNotifications
} = require('../services/parliamentLatestVoteNotificationsService');
const { sendFinalBallotPush } = require('../services/parliamentFinalBallotPushService');
const { upsertVerifiedCurrentVote } = require('../services/institutionalCurrentNominalVotesService');

const connection = new URL(process.env.TEST_PARLIAMENT_PG_URL || 'postgres://invalid');
if (process.env.TEST_PARLIAMENT_PG_EPHEMERAL !== 'true' ||
    !['127.0.0.1', 'localhost'].includes(connection.hostname) ||
    connection.port !== '55432' || connection.pathname !== '/demos_test' ||
    connection.username !== 'demos_test') {
  throw new Error('REFUSE_NON_EPHEMERAL_POSTGRES');
}
const pool = new Pool({ connectionString:connection.href,max:4,connectionTimeoutMillis:5000 });
const root=path.join(__dirname,'../..');
const rep='00000000-0000-4000-8000-000000000001';
const follower='00000000-0000-4000-8000-000000000002';
const other='00000000-0000-4000-8000-000000000003';
const baseDate='2026-10-21';
const members=Array.from({length:125},(_,i)=>({
  name:i===2?'DE LUCA MARIA':'PERSONA CON NOME '+i,
  group:'GRUPPO',vote:i===2?'In missione':'Favorevole'
}));
function finalVote(id,date, chamber='Camera'){
  return {openpolis_id:id,camera:chamber,titolo:'Votazione finale sintetica',
    esito:'Approvata',data_votazione:date,
    url_dettaglio:'https://parlamento19.openpolis.it/votazioni/'+id};
}
function verified(vote){
  return {voteId:vote.openpolis_id,chamber:vote.camera,
    date:vote.data_votazione,source:{type:'official',url:'https://documenti.camera.it/fixture'},
    members};
}

async function main(){
  const prevN=process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
  const prevP=process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
  try{
    // Exact legacy table definition from repo, including old CHECK constraints.
    await pool.query([
      'CREATE TABLE users (id uuid PRIMARY KEY, nome text,cognome text,status varchar(10) NOT NULL);',
      'CREATE TABLE political_selections (user_id uuid REFERENCES users(id),selected_user_id uuid REFERENCES users(id),selection_kind text,political_office_id text);',
      'CREATE TABLE political_mandates (user_id uuid REFERENCES users(id),status text,office_code text,starts_at timestamptz,ends_at timestamptz);',
      'CREATE TABLE notifiche_preferenze (user_id uuid REFERENCES users(id),deputato boolean,senatore boolean);',
      'CREATE TABLE user_devices (user_id uuid REFERENCES users(id),fcm_token text,is_active boolean);',
      'CREATE TABLE reazioni (comunicazione_id varchar(50),utente_id varchar(50));',
      'CREATE TABLE openpolis_votazioni_finali_decisive (openpolis_id varchar(50) PRIMARY KEY,camera varchar(50),titolo text,url_dettaglio text,esito varchar(20),data_votazione date);'
    ].join('\n'));
    await pool.query(fs.readFileSync(path.join(root,'api/create-notifiche-voti-parlamento-table.sql'),'utf8'));
    await pool.query(fs.readFileSync(path.join(root,'api/database/20261103_latest_parliament_votes.sql'),'utf8'));
    await pool.query(fs.readFileSync(path.join(root,'api/database/20261103_latest_parliament_votes.sql'),'utf8'));
    await pool.query(fs.readFileSync(path.join(root,'api/database/20261108_institutional_current_nominal_votes.sql'),'utf8'));
    // Regression: 65 new Camera votes must NOT push a less frequent Senate
    // vote out of the bounded source window. Same-day numeric ordering matters.
    await pool.query(
      "INSERT INTO openpolis_votazioni_finali_decisive " +
      "(openpolis_id,camera,titolo,url_dettaglio,esito,data_votazione) " +
      "SELECT 'vs19_730_' || n::text, 'Camera', 'Camera synthetic final', " +
      "'https://parlamento19.openpolis.it/votazioni/vs19_730_' || n::text, " +
      "'Approvata', CURRENT_DATE FROM generate_series(1,65) n"
    );
    await pool.query(
      "INSERT INTO openpolis_votazioni_finali_decisive " +
      "(openpolis_id,camera,titolo,url_dettaglio,esito,data_votazione) " +
      "VALUES ('19-469-6','Senato','Senate synthetic final'," +
      "'https://parlamento19.openpolis.it/votazioni/19-469-6','Approvata',CURRENT_DATE)"
    );
    const window = (await pool.query(LATEST_FINAL_BALLOTS_SQL)).rows;
    assert.equal(window.length,51,'50 Camera plus 1 Senate finalist; never globally truncate Senate');
    assert.equal(window.filter(row=>row.camera==='Camera').length,50);
    assert.equal(window.filter(row=>row.camera==='Senato').length,1);
    assert.equal(window.find(row=>row.camera==='Senato').openpolis_id,'19-469-6');
    assert.equal(window.filter(row=>row.camera==='Camera')[0].openpolis_id,'vs19_730_65',
      'numeric ordering must beat lexicographic ordering for same-day IDs');
    const unique = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename='notifiche_voti_parlamento' AND indexname='notifiche_voti_parlamento_latest_rep_camera'");
    assert.equal(unique.rows.length,1,'migration creates exactly one shared unique key');

    await pool.query('INSERT INTO users(id,nome,cognome,status) VALUES ($1,$2,$3,$4),($5,$6,$7,$8),($9,$10,$11,$12)',
      [rep,'Maria','De Luca','a',follower,'Follower','Uno','a',other,'Altro','Utente','a']);
    await pool.query("INSERT INTO political_mandates (user_id,status,office_code,starts_at) VALUES ($1,'ACTIVE','C',NOW()-INTERVAL '7 days')",[rep]);
    await pool.query("INSERT INTO political_selections (user_id,selected_user_id,selection_kind,political_office_id) VALUES ($1,$2,'representative','it.camera')",[follower,rep]);
    await pool.query('INSERT INTO notifiche_preferenze (user_id,deputato,senatore) VALUES ($1,TRUE,FALSE)',[follower]);
    const token='T'.repeat(130);
    await pool.query('INSERT INTO user_devices (user_id,fcm_token,is_active) VALUES ($1,$2,TRUE)',[follower,token]);

    const reps=await selectedRepresentatives(pool,'Camera');
    assert.deepEqual(reps.map(r=>r.id),[rep], 'only current active selected MP');
    assert.deepEqual(await selectedRepresentatives(pool,'Senato'),[],'not accidentally a senator');
    const first=finalVote('vs19_730_097',baseDate),second=finalVote('vs19_731_005','2026-10-22');
    let result=await persistLatestForChamber(pool,first,verified(first),reps);
    assert.equal(result.changed,1);
    const read=()=>pool.query('SELECT id,openpolis_id,politico,camera,voto,data,vote_order,likes,dislikes FROM notifiche_voti_parlamento');
    let rows=(await read()).rows;
    assert.equal(rows.length,1);
    const noteId=rows[0].id;
    assert.equal(rows[0].voto,'In missione','no invented against vote');
    await pool.query('INSERT INTO reazioni (comunicazione_id,utente_id) VALUES ($1,$2)',[noteId,follower]);
    result=await persistLatestForChamber(pool,second,verified(second),reps);
    assert.equal(result.changed,1);
    rows=(await read()).rows;
    assert.equal(rows.length,1,'latest notification replaces rather than appends');
    assert.equal(rows[0].id,noteId,'same shared row');
    assert.equal(rows[0].openpolis_id,second.openpolis_id);
    assert.equal((await pool.query('SELECT count(*)::int n FROM reazioni')).rows[0].n,0,'old reaction not inherited');

    result=await persistLatestForChamber(pool,first,verified(first),reps);
    assert.equal(result.changed,0,'out-of-order older vote ignored');
    let current=(await pool.query(
      "SELECT representative_key,ballot_id,vote_date,ballot_order FROM public.institutional_current_nominal_votes WHERE institution='Camera'"
    )).rows;
    assert.equal(current.length,1,'exactly one nominal current vote per representative');
    assert.equal(current[0].representative_key,'demos:'+rep);
    assert.equal(current[0].ballot_id,second.openpolis_id,'older sync cannot restore old vote');
    const currentAttempt=await upsertVerifiedCurrentVote(pool,{
      institution:'Camera', representativeKey:'demos:'+rep,
      ballotId:'vs19_731_006', voteDate:'2026-10-22', ballotOrder:73100006,
      status:'Contrario',ballotTitle:'Even later synthetic final',
      sourceUrl:'https://documenti.camera.it/fixture',sourceType:'camera_ufficiale',verified:true
    });
    assert.equal(currentAttempt.changed,true,'higher order on same date replaces');
    current=(await pool.query(
      "SELECT ballot_id FROM public.institutional_current_nominal_votes WHERE institution='Camera'"
    )).rows;
    assert.equal(current.length,1);
    assert.equal(current[0].ballot_id,'vs19_731_006');
    const replay=await upsertVerifiedCurrentVote(pool,{
      institution:'Camera', representativeKey:'demos:'+rep,
      ballotId:first.openpolis_id, voteDate:baseDate, ballotOrder:73000097,
      status:'Favorevole',ballotTitle:'Old synthetic final',
      sourceUrl:'https://documenti.camera.it/fixture',sourceType:'camera_ufficiale',verified:true
    });
    assert.equal(replay.changed,false,'newer current record cannot regress');
    result=await persistLatestForChamber(pool,second,verified(second),reps);
    assert.equal(result.changed,0,'replay idempotent');
    assert.equal((await read()).rows[0].openpolis_id,second.openpolis_id);
    await assert.rejects(persistLatestForChamber(pool,second,
      {...verified(second),date:'2026-10-23'},reps),/LATEST_VOTE_SOURCE_MISMATCH/);
    assert.equal((await read()).rows.length,1);

    // Current selection and opt-in checked AGAIN while recipient rows locked.
    const sends=[];
    process.env.PARLIAMENT_FINAL_PUSH_ENABLED='true';
    const admin={messaging:()=>({sendEach:async messages=>{
      sends.push(...messages);
      return {successCount:messages.length,failureCount:0};
    }})};
    let push=await sendFinalBallotPush(pool,{representativeId:rep,chamber:'Camera',
      openpolisId:second.openpolis_id,title:second.titolo,status:'In missione'}, {firebaseAdmin:admin});
    assert.equal(push.sent,1);
    assert.equal(sends.length,1);
    await pool.query('UPDATE notifiche_preferenze SET deputato=FALSE WHERE user_id=$1',[follower]);
    push=await sendFinalBallotPush(pool,{representativeId:rep,chamber:'Camera',
      openpolisId:second.openpolis_id,title:second.titolo,status:'In missione'}, {firebaseAdmin:admin});
    assert.equal(push.sent,0,'consent OFF prevents further sends');
    await pool.query('UPDATE notifiche_preferenze SET deputato=TRUE WHERE user_id=$1',[follower]);
    await pool.query("UPDATE political_selections SET selected_user_id=$1 WHERE user_id=$2",[other,follower]);
    push=await sendFinalBallotPush(pool,{representativeId:rep,chamber:'Camera',
      openpolisId:second.openpolis_id,title:second.titolo,status:'In missione'}, {firebaseAdmin:admin});
    assert.equal(push.sent,0,'representative switch prevents further sends');
    await pool.query('UPDATE political_selections SET selected_user_id=$1 WHERE user_id=$2',[rep,follower]);

    // Race: while Firebase callback is pending, opt-out update must wait for
    // the row-level FOR SHARE lock, then commit immediately afterwards.
    let enterSend;
    let releaseSend;
    const entered=new Promise(resolve=>{enterSend=resolve});
    const hold=new Promise(resolve=>{releaseSend=resolve});
    const raceAdmin={messaging:()=>({sendEach:async messages=>{
      enterSend();
      await hold;
      return {successCount:messages.length,failureCount:0};
    }})};
    const ongoing=sendFinalBallotPush(pool,{representativeId:rep,chamber:'Camera',
      openpolisId:second.openpolis_id,title:second.titolo,status:'In missione'},{firebaseAdmin:raceAdmin});
    await entered;
    let revoked=false;
    const revoke=pool.query('UPDATE notifiche_preferenze SET deputato=FALSE WHERE user_id=$1',[follower])
      .then(()=>{revoked=true});
    // Check with a second independent PostgreSQL client, no network calls.
    await new Promise(resolve=>setTimeout(resolve,150));
    assert.equal(revoked,false,'opt-out waits until already accepted push is settled');
    releaseSend();
    assert.equal((await ongoing).sent,1);
    await revoke;
    assert.equal(revoked,true);
    const post=await sendFinalBallotPush(pool,{representativeId:rep,chamber:'Camera',
      openpolisId:second.openpolis_id,title:second.titolo,status:'In missione'},{firebaseAdmin:admin});
    assert.equal(post.sent,0,'no push can begin after opt-out commits');

    // Orchestration disabled means no DB writes even when this table exists.
    delete process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
    assert.equal((await refreshLatestParliamentVoteNotifications(pool)).enabled,false);
    console.log('POSTGRES REAL PASS: fair per-chamber 50+50 source bounds, migration x2, FK/unique/upsert monotonicity, reactions, source, selected MP, consent, token, opt-out locking.');
  } finally {
    if(prevN===undefined)delete process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED;
    else process.env.PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED=prevN;
    if(prevP===undefined)delete process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
    else process.env.PARLIAMENT_FINAL_PUSH_ENABLED=prevP;
    await pool.end();
  }
}
main().catch(error=>{console.error(error?.message||'PG_TEST_FAILED');process.exitCode=1});
