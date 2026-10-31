'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const manifest=require('../experiments/opinionAnswersV2HistoricalManifest.json');
const {
  SQL,projectHybridGdprSubjectExport,
  deleteHybridOpinionsInsideGdprTransaction,
  planHybridPostRestoreErasure
}=require('../experiments/opinionAnswersV2HybridGdprCandidate');

const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri&&process.env.GITHUB_ACTIONS==='true');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ids=manifest.historicalIds;
const first=ids[0],archived=ids[17];
const tables=['ci_hgdpr_opinions','ci_hgdpr_users'];
function guard(){
  const x=new URL(uri);
  if(process.env.GITHUB_ACTIONS!=='true'||
     !['localhost','127.0.0.1','::1'].includes(x.hostname)||
     x.pathname!=='/opinion_answers_ci')throw Error('Refusing non-ephemeral database');
}
async function drop(db){
  for(const table of tables)await db.query('DROP TABLE IF EXISTS '+table);
}
const fakeRow=async(db,id)=>{
  const r=await db.query('SELECT * FROM ci_hgdpr_opinions WHERE user_id=$1',[id]);
  return r.rows[0]||null;
};
// Research model: an authorized, external gateway MUST close this gate
// before any restored DB is allowed to serve traffic. The fixture gate
// lives only in test memory and is NOT a production security design.
function requireExternalGate(gate){
  if(gate.ready!==true||gate.externalLedgerVerified!==true){
    throw Error('GDPR_RESTORE_NOT_RECONCILED');
  }
}

test('PG17 hybrid GDPR: same-row erasure and post-backup regrant cannot resurrect',
  {skip:!enabled},async t=>{
  guard();
  const db=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  await db.connect();
  try{
    await drop(db);
    await db.query(
      'CREATE TABLE ci_hgdpr_users(id uuid PRIMARY KEY,consent boolean NOT NULL)'
    );
    await db.query('CREATE TABLE ci_hgdpr_opinions('+
      'user_id uuid PRIMARY KEY REFERENCES ci_hgdpr_users(id) ON DELETE CASCADE,'+
      ids.map(id=>'"'+id+'" text').join(',')+
      ",fonti_opinioni jsonb NOT NULL DEFAULT '{}'::jsonb,"+
      "answers_extra jsonb CHECK(answers_extra IS NULL OR jsonb_typeof(answers_extra)='object'))"
    );
    for(const id of [uid(1),uid(2),uid(3)]){
      await db.query('INSERT INTO ci_hgdpr_users VALUES($1,true)',[id]);
      await db.query(
        'INSERT INTO ci_hgdpr_opinions(user_id,"'+first+'","'+archived+'",'+
        'answers_extra,fonti_opinioni) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',
        [id,'f','c',JSON.stringify({
          opinione_95_synthetic:'i',opinione_archived_future:'f'
        }),JSON.stringify({
          [first]:'synthetic historical source',
          opinione_95_synthetic:'synthetic new source',
          opinione_archived_future:'archived synthetic source'
        })]
      );
    }

    await t.test('authorized export includes archived historical/future answers and both source classes',async()=>{
      const row=await fakeRow(db,uid(1));
      const out=projectHybridGdprSubjectExport(uid(1),row,ids);
      assert.equal(out.answers_by_id[first],'f');
      assert.equal(out.answers_by_id[archived],'c');
      assert.equal(out.answers_by_id.opinione_95_synthetic,'i');
      assert.equal(out.answers_by_id.opinione_archived_future,'f');
      assert.equal(out.sources_by_id[first],'synthetic historical source');
      assert.equal(out.sources_by_id.opinione_archived_future,'archived synthetic source');
      assert.throws(()=>projectHybridGdprSubjectExport(uid(2),row,ids),/SUBJECT_MISMATCH/);
    });

    await t.test('rollback after failed ledger write retains all answers, overflow, sources and consent',async()=>{
      const before=await fakeRow(db,uid(1));
      await db.query('BEGIN');
      try{
        await db.query('SELECT id FROM ci_hgdpr_users WHERE id=$1 FOR UPDATE',[uid(1)]);
        await db.query('UPDATE ci_hgdpr_users SET consent=false WHERE id=$1',[uid(1)]);
        const deletion=await db.query(
          SQL.deleteWholeRow.replaceAll('public.opinioni_risposte','ci_hgdpr_opinions'),
          [uid(1)]
        );
        assert.equal(deletion.rowCount,1);
        // Simulate mandatory privacy ledger write failure after deleting.
        await assert.rejects(db.query('SELECT 1/0'),/division by zero/);
        await db.query('ROLLBACK');
      }catch(e){await db.query('ROLLBACK');throw e;}
      assert.deepEqual(await fakeRow(db,uid(1)),before);
      assert.equal((await db.query('SELECT consent FROM ci_hgdpr_users WHERE id=$1',[uid(1)])).rows[0].consent,true);
    });

    await t.test('revocation deletes one whole row, no empty overflow or archived source remains',async()=>{
      await db.query('BEGIN');
      try{
        await db.query('SELECT id FROM ci_hgdpr_users WHERE id=$1 FOR UPDATE',[uid(1)]);
        await db.query('UPDATE ci_hgdpr_users SET consent=false WHERE id=$1',[uid(1)]);
        const mock={
          query:(sql,params)=>db.query(
            sql.replaceAll('public.opinioni_risposte','ci_hgdpr_opinions'),params
          )
        };
        assert.equal(await deleteHybridOpinionsInsideGdprTransaction(mock,uid(1)),1);
        assert.equal(await deleteHybridOpinionsInsideGdprTransaction(mock,uid(1)),0);
        await db.query('COMMIT');
      }catch(e){await db.query('ROLLBACK');throw e;}
      assert.equal(await fakeRow(db,uid(1)),null);
      assert.equal((await db.query('SELECT consent FROM ci_hgdpr_users WHERE id=$1',[uid(1)])).rows[0].consent,false);
      assert.notEqual(await fakeRow(db,uid(2)),null);
    });

    await t.test('new consent creates a NEW row only after explicit fresh save',async()=>{
      await db.query('UPDATE ci_hgdpr_users SET consent=true WHERE id=$1',[uid(1)]);
      assert.equal(await fakeRow(db,uid(1)),null);
      await db.query('INSERT INTO ci_hgdpr_opinions(user_id,answers_extra) VALUES($1,$2::jsonb)',
        [uid(1),JSON.stringify({opinione_95_synthetic:'f'})]);
      const out=projectHybridGdprSubjectExport(uid(1),await fakeRow(db,uid(1)),ids);
      assert.deepEqual({...out.answers_by_id},{opinione_95_synthetic:'f'});
      assert.deepEqual({...out.sources_by_id},{});
    });

    await t.test('restored OLD row plus revoke→regrant ledger is not publishable until replay',async()=>{
      // User 2 is in an old snapshot with all 94 old fields, future
      // answers and historical sources. The external event store is
      // intentionally modelled as a separate JS fixture.
      const snapshot=await fakeRow(db,uid(2));
      const gate={ready:false,externalLedgerVerified:false};
      assert.throws(()=>requireExternalGate(gate),/NOT_RECONCILED/);
      const externalEvents=[
        {event_key:'granted-again',subject_user_id:uid(2),
          event_type:'political_consent_granted',occurred_at:'2026-10-30T13:00:00Z'},
        {event_key:'revoked-old',subject_user_id:uid(2),
          event_type:'political_consent_revoked',occurred_at:'2026-10-30T12:00:00Z'}
      ];
      const plan=planHybridPostRestoreErasure(externalEvents,{
        snapshotAt:'2026-10-30T11:00:00Z'
      });
      assert.deepEqual(plan,[{
        user_id:uid(2),erase_hybrid_opinion_row:true,account_deleted:false
      }]);
      // The snapshot still exists in the database until the ledger
      // replay runs, but no authorized read may pass the external gate.
      assert.deepEqual(await fakeRow(db,uid(2)),snapshot);
      assert.throws(()=>requireExternalGate(gate),/NOT_RECONCILED/);
      await db.query('BEGIN');
      try{
        for(const step of plan){
          await db.query('SELECT id FROM ci_hgdpr_users WHERE id=$1 FOR UPDATE',[step.user_id]);
          const result=await db.query(
            SQL.deleteWholeRow.replaceAll('public.opinioni_risposte','ci_hgdpr_opinions'),
            [step.user_id]
          );
          assert.equal(result.rowCount,1);
        }
        await db.query('COMMIT');
      }catch(e){await db.query('ROLLBACK');throw e;}
      // The external coordinator, not the DB restore itself, makes
      // this assertion once its durable ledger/watermark is verified.
      gate.externalLedgerVerified=true;
      gate.ready=true;
      requireExternalGate(gate);
      assert.equal(await fakeRow(db,uid(2)),null);
      assert.notEqual(await fakeRow(db,uid(3)),null);
      assert.equal((await db.query('SELECT consent FROM ci_hgdpr_users WHERE id=$1',[uid(2)])).rows[0].consent,true);
    });

    await t.test('full account deletion cascades entire hybrid answers row',async()=>{
      assert.notEqual(await fakeRow(db,uid(3)),null);
      await db.query('DELETE FROM ci_hgdpr_users WHERE id=$1',[uid(3)]);
      assert.equal(await fakeRow(db,uid(3)),null);
    });

    await t.test('a missing hybrid table fails closed; no silent erasure success',async()=>{
      await db.query('BEGIN');
      try{
        await assert.rejects(db.query(
          SQL.deleteWholeRow.replaceAll('public.opinioni_risposte','ci_hgdpr_intentionally_absent'),
          [uid(1)]),error=>error.code==='42P01');
        await db.query('ROLLBACK');
      }catch(e){await db.query('ROLLBACK');throw e;}
      assert.equal((await db.query('SELECT consent FROM ci_hgdpr_users WHERE id=$1',[uid(1)])).rows[0].consent,true);
    });
  }finally{
    await drop(db);
    await db.end();
  }
});
