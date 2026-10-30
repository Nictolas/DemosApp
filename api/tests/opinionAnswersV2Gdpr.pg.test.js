'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {
  SELECT_V2_EXPORT_SQL,
  deleteV2AnswersInsideGdprTransaction,
  projectV2GdprExport,
  planPostSnapshotPoliticalErasure
}=require('../experiments/opinionAnswersV2GdprCandidate');

const connectionString=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(connectionString && process.env.GITHUB_ACTIONS==='true');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function assertOnlyDisposableCi(){
  const parsed=new URL(connectionString);
  if(!['localhost','127.0.0.1','::1'].includes(parsed.hostname) ||
     parsed.pathname!=='/opinion_answers_ci' ||
     process.env.GITHUB_ACTIONS!=='true') {
    throw new Error('Refusing any nonlocal, non-ephemeral database');
  }
}
test('PostgreSQL 17: v2 erasure/export and post-snapshot regrant replay contract',
  {skip:!enabled},async t=>{
  assertOnlyDisposableCi();
  const db=new Client({connectionString,connectionTimeoutMillis:5000});
  await db.connect();
  try {
    await db.query('CREATE SCHEMA IF NOT EXISTS demos_private');
    await db.query('DROP TABLE IF EXISTS demos_private.opinion_answer_maps_v2');
    await db.query('DROP TABLE IF EXISTS ci_v2_gdpr_legacy');
    await db.query('DROP TABLE IF EXISTS ci_v2_gdpr_users');
    await db.query('CREATE TABLE ci_v2_gdpr_users (id uuid PRIMARY KEY, consent boolean NOT NULL)');
    await db.query('CREATE TABLE ci_v2_gdpr_legacy (user_id uuid PRIMARY KEY REFERENCES ci_v2_gdpr_users(id), answer text)');
    await db.query(`CREATE TABLE demos_private.opinion_answer_maps_v2 (
      user_id uuid PRIMARY KEY REFERENCES ci_v2_gdpr_users(id),
      answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='object')
    )`);
    for(const i of [1,2,3]){
      await db.query('INSERT INTO ci_v2_gdpr_users VALUES ($1,true)',[uid(i)]);
      await db.query("INSERT INTO ci_v2_gdpr_legacy VALUES ($1,'f')",[uid(i)]);
      await db.query(
        'INSERT INTO demos_private.opinion_answer_maps_v2 VALUES ($1,$2::jsonb)',
        [uid(i),JSON.stringify({opinione_0:'f',opinione_archived:'c'})]
      );
    }
    await t.test('authorized subject export includes archived answers and no other account fields',async()=>{
      const result=await db.query(SELECT_V2_EXPORT_SQL,[uid(1)]);
      assert.equal(result.rowCount,1);
      const out=projectV2GdprExport(uid(1),result.rows[0]);
      assert.deepEqual({...out.answers_by_id},{opinione_0:'f',opinione_archived:'c'});
      assert.equal(out.answer_sources_included,false);
      assert.throws(()=>projectV2GdprExport(uid(2),result.rows[0]),/SUBJECT_MISMATCH/);
    });
    await t.test('a failed revocation transaction rolls back BOTH representations',async()=>{
      await db.query('BEGIN');
      try {
        await db.query('SELECT id FROM ci_v2_gdpr_users WHERE id=$1 FOR UPDATE',[uid(1)]);
        await db.query('UPDATE ci_v2_gdpr_users SET consent=false WHERE id=$1',[uid(1)]);
        await db.query('DELETE FROM ci_v2_gdpr_legacy WHERE user_id=$1',[uid(1)]);
        assert.equal(await deleteV2AnswersInsideGdprTransaction(db,uid(1)),1);
        // Force a statement failure after the two deletes and consent change.
        await assert.rejects(db.query('SELECT 1/0'),/division by zero/);
        await db.query('ROLLBACK');
      } catch(error) {
        await db.query('ROLLBACK');
        throw error;
      }
      assert.equal((await db.query('SELECT consent FROM ci_v2_gdpr_users WHERE id=$1',[uid(1)])).rows[0].consent,true);
      assert.equal((await db.query('SELECT count(*)::integer AS n FROM ci_v2_gdpr_legacy WHERE user_id=$1',[uid(1)])).rows[0].n,1);
      assert.equal((await db.query(SELECT_V2_EXPORT_SQL,[uid(1)])).rowCount,1);
    });
    await t.test('successful same-transaction revocation removes old and v2, then is idempotent',async()=>{
      await db.query('BEGIN');
      try {
        await db.query('SELECT id FROM ci_v2_gdpr_users WHERE id=$1 FOR UPDATE',[uid(1)]);
        await db.query('UPDATE ci_v2_gdpr_users SET consent=false WHERE id=$1',[uid(1)]);
        await db.query('DELETE FROM ci_v2_gdpr_legacy WHERE user_id=$1',[uid(1)]);
        assert.equal(await deleteV2AnswersInsideGdprTransaction(db,uid(1)),1);
        await db.query('COMMIT');
      } catch(error) {await db.query('ROLLBACK');throw error;}
      assert.equal((await db.query('SELECT count(*)::integer AS n FROM ci_v2_gdpr_legacy WHERE user_id=$1',[uid(1)])).rows[0].n,0);
      assert.equal((await db.query(SELECT_V2_EXPORT_SQL,[uid(1)])).rowCount,0);
      await db.query('BEGIN');
      assert.equal(await deleteV2AnswersInsideGdprTransaction(db,uid(1)),0);
      await db.query('COMMIT');
    });
    await t.test('old backup answers are erased despite grant AFTER revocation',async()=>{
      // This fixture represents an old snapshot for user 2. The real
      // external event store and complete watermark are NOT tested here.
      const events=[
        {event_key:'grant-later',subject_user_id:uid(2),
          event_type:'political_consent_granted',occurred_at:'2026-10-30T13:00:00.000Z'},
        {event_key:'revocation-earlier',subject_user_id:uid(2),
          event_type:'political_consent_revoked',occurred_at:'2026-10-30T12:00:00.000Z'}
      ];
      const plan=planPostSnapshotPoliticalErasure(events,{snapshotAt:'2026-10-30T11:00:00.000Z'});
      assert.deepEqual(plan.map(x=>x.user_id),[uid(2)]);
      // User may have given consent again, but the old pre-revocation
      // answers MUST NOT return from the restored snapshot.
      await db.query('BEGIN');
      try {
        for(const action of plan){
          await db.query('SELECT id FROM ci_v2_gdpr_users WHERE id=$1 FOR UPDATE',[action.user_id]);
          await db.query('DELETE FROM ci_v2_gdpr_legacy WHERE user_id=$1',[action.user_id]);
          await deleteV2AnswersInsideGdprTransaction(db,action.user_id);
        }
        await db.query('COMMIT');
      } catch(error){await db.query('ROLLBACK');throw error;}
      assert.equal((await db.query(SELECT_V2_EXPORT_SQL,[uid(2)])).rowCount,0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM ci_v2_gdpr_legacy WHERE user_id=$1',[uid(2)])).rows[0].n,0);
      assert.equal((await db.query('SELECT consent FROM ci_v2_gdpr_users WHERE id=$1',[uid(2)])).rows[0].consent,true);
    });
    await t.test('deletion fails loudly when v2 table missing, leaving legacy transaction rolled back',async()=>{
      await db.query('DROP TABLE demos_private.opinion_answer_maps_v2');
      await db.query('BEGIN');
      try {
        await db.query('DELETE FROM ci_v2_gdpr_legacy WHERE user_id=$1',[uid(3)]);
        await assert.rejects(
          deleteV2AnswersInsideGdprTransaction(db,uid(3)),
          error=>error.code==='42P01'
        );
        await db.query('ROLLBACK');
      } catch(error){await db.query('ROLLBACK');throw error;}
      assert.equal((await db.query('SELECT count(*)::int AS n FROM ci_v2_gdpr_legacy WHERE user_id=$1',[uid(3)])).rows[0].n,1);
    });
  } finally {
    await db.query('DROP TABLE IF EXISTS demos_private.opinion_answer_maps_v2');
    await db.query('DROP TABLE IF EXISTS ci_v2_gdpr_legacy');
    await db.query('DROP TABLE IF EXISTS ci_v2_gdpr_users');
    await db.query('DROP SCHEMA IF EXISTS demos_private');
    await db.end();
  }
});
