'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {planHybridAnswerChanges,buildHybridAtomicAnswerUpsert,
  projectHybridAnswers,formatHybridLegacyGradePayload,formatHybridProfileOpinions,SQL}=
  require('../experiments/opinionAnswersV2HybridCandidate');
// Fully invented PostgreSQL fixture. No DEMOS or staging access.
const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri&&process.env.GITHUB_ACTIONS==='true');
const uid='00000000-0000-4000-8000-000000000099';
const legacy=Array.from({length:94},(_,i)=>'opinione_'+i);
const published=new Set([...legacy,'opinione_94','opinione_95']);
function guard(){
  const u=new URL(uri);
  if(!['localhost','127.0.0.1','::1'].includes(u.hostname)||
      u.pathname!=='/opinion_answers_ci'||process.env.GITHUB_ACTIONS!=='true'){
    throw new Error('Refusing non-ephemeral PostgreSQL');
  }
}
const upsert=SQL.upsertOverflow.replaceAll('opinioni_risposte','ci_hybrid_answers');
async function write(db,input,{afterLock}={}){
  await db.query('BEGIN');
  try{
    await db.query("SET LOCAL lock_timeout='5s'");
    const user=await db.query('SELECT id FROM ci_hybrid_users WHERE id=$1 FOR UPDATE',[uid]);
    if(!user.rowCount){await db.query('ROLLBACK');return 'missing';}
    if(afterLock)await afterLock();
    const consent=await db.query('SELECT consent FROM ci_hybrid_users WHERE id=$1',[uid]);
    if(!consent.rows[0].consent){await db.query('ROLLBACK');return 'no-consent';}
    const previous=await db.query(
      'SELECT * FROM ci_hybrid_answers WHERE user_id=$1 FOR UPDATE',[uid]
    );
    const plan=planHybridAnswerChanges(previous.rows[0]||null,input,published,legacy);
    if(plan.changedCount===0){await db.query('COMMIT');return 'unchanged';}
    const statement=buildHybridAtomicAnswerUpsert(plan.changed,published,legacy,uid);
    const written=await db.query(
      statement.sql.replaceAll('opinioni_risposte','ci_hybrid_answers'),statement.params
    );
    assert.equal(written.rowCount,1);
    await db.query('COMMIT');
    return 'saved';
  }catch(error){await db.query('ROLLBACK');throw error;}
}
async function schemaCount(db){
  const r=await db.query(
    "SELECT count(*)::int AS n FROM information_schema.columns "+
    "WHERE table_schema='public' AND table_name='ci_hybrid_answers'"
  );
  return r.rows[0].n;
}
test('PG17 hybrid: existing 94 columns + one permanent overflow JSONB', {skip:!enabled},async t=>{
  guard();
  const a=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  const b=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  await a.connect();
  try{
    await b.connect();
    await a.query('DROP TABLE IF EXISTS ci_hybrid_answers');
    await a.query('DROP TABLE IF EXISTS ci_hybrid_users');
    await a.query('CREATE TABLE ci_hybrid_users(id uuid PRIMARY KEY,consent boolean NOT NULL)');
    await a.query('CREATE TABLE ci_hybrid_answers ('+
      'user_id uuid PRIMARY KEY REFERENCES ci_hybrid_users(id) ON DELETE CASCADE,'+
      legacy.map(x=>'"'+x+'" text').join(',')+
      ",fonti_opinioni jsonb NOT NULL DEFAULT '{}'::jsonb,"+
      "answers_extra jsonb CHECK(answers_extra IS NULL OR jsonb_typeof(answers_extra)='object'))");
    await a.query('INSERT INTO ci_hybrid_users VALUES($1,true)',[uid]);
    await a.query('INSERT INTO ci_hybrid_answers(user_id,"opinione_0","opinione_93",fonti_opinioni) '+
      'VALUES($1,$2,$3,$4::jsonb)',[uid,'f','i','{"opinione_0":"historic source"}']);
    const before=await schemaCount(a);
    assert.equal(before,97); // user_id, 94 TEXT, fonti_opinioni, answers_extra
    await t.test('new 95th/96th opinions need no new SQL columns and no extra SELECT',async()=>{
      assert.equal(await write(a,{opinione_94:'c',opinione_95:'f'}),'saved');
      assert.equal(await schemaCount(a),before);
      const oneRead=await a.query('SELECT * FROM ci_hybrid_answers WHERE user_id=$1',[uid]);
      assert.equal(oneRead.rowCount,1);
      const meta=[{id:'opinione_0',text:'old',gradi_opinione:['N']},
        {id:'opinione_94',text:'new',gradi_opinione:['N']},
        {id:'opinione_95',text:'newer',gradi_opinione:['N']}];
      assert.deepEqual(projectHybridAnswers(oneRead.rows[0],meta,legacy)
        .map(x=>x.userAnswer),['f','c','f']);
      assert.deepEqual(oneRead.rows[0].fonti_opinioni,{opinione_0:'historic source'});
    });
    await t.test('old columns and future keys update atomically without stale map replacement',async()=>{
      assert.equal(await write(a,{opinione_0:'c',opinione_94:'i'}),'saved');
      const r=await a.query('SELECT "opinione_0","opinione_93",answers_extra FROM ci_hybrid_answers WHERE user_id=$1',[uid]);
      assert.equal(r.rows[0].opinione_0,'c');
      assert.equal(r.rows[0].opinione_93,'i');
      assert.deepEqual(r.rows[0].answers_extra,{opinione_94:'i',opinione_95:'f'});
      assert.equal(await schemaCount(a),before);
    });
    await t.test('concurrent future-ID edits serialize without losing either key',async()=>{
      const saved=await Promise.all([
        write(a,{opinione_94:'c'}),
        write(b,{opinione_95:'i'})
      ]);
      assert.deepEqual(saved,['saved','saved']);
      const result=await a.query(
        'SELECT answers_extra,fonti_opinioni FROM ci_hybrid_answers WHERE user_id=$1',[uid]
      );
      assert.deepEqual(result.rows[0].answers_extra,{opinione_94:'c',opinione_95:'i'});
      assert.deepEqual(result.rows[0].fonti_opinioni,{opinione_0:'historic source'});
      assert.equal(await write(a,{opinione_94:'i'}),'saved');
    });
    await t.test('archiving only removes public projection, NOT the stored answer',async()=>{
      const r=await a.query('SELECT * FROM ci_hybrid_answers WHERE user_id=$1',[uid]);
      const currentlyPublished=[{id:'opinione_0',text:'still public',gradi_opinione:['N']}];
      assert.deepEqual(projectHybridAnswers(r.rows[0],currentlyPublished,legacy)
        .map(x=>x.id),['opinione_0']);
      assert.equal(r.rows[0].answers_extra.opinione_94,'i');
    });
    await t.test('mixed first save inserts legacy and 95th answer atomically',async()=>{
      await a.query('DELETE FROM ci_hybrid_answers WHERE user_id=$1',[uid]);
      assert.equal(await write(a,{opinione_0:'i',opinione_94:'c'}),'saved');
      const result=await a.query('SELECT "opinione_0",answers_extra FROM ci_hybrid_answers WHERE user_id=$1',[uid]);
      assert.equal(result.rowCount,1);
      assert.equal(result.rows[0].opinione_0,'i');
      assert.deepEqual(result.rows[0].answers_extra,{opinione_94:'c'});
      assert.equal(await write(a,{opinione_0:'i',opinione_94:'c'}),'unchanged');
      assert.equal(await schemaCount(a),before);
    });
    await t.test('legacy GET and profile formatting agree on answer but not external IDs',async()=>{
      const r=await a.query('SELECT * FROM ci_hybrid_answers WHERE user_id=$1',[uid]);
      const opinions=[{id:'opinione_0',text:'Politica sanitaria?',gradi_opinione:['N']},
        {id:'opinione_94',text:'Nuova Opinione 95',gradi_opinione:['N']}];
      const compatibility=formatHybridLegacyGradePayload(r.rows[0],opinions,legacy,'N');
      const profile=formatHybridProfileOpinions(r.rows[0],opinions,legacy);
      assert.deepEqual(compatibility.data.map(x=>x.userAnswer),['i','c']);
      assert.deepEqual(compatibility.data.map(x=>x.id),['politica_sanitaria?','nuova_opinione_95']);
      assert.deepEqual(profile.map(x=>x.id),['opinione_0','opinione_94']);
      assert.equal(profile[0].source,'unknown');
    });
    await t.test('revocation gets lock first and queued new-opinion write cannot resurrect',async()=>{
      await b.query('BEGIN');
      await b.query('SELECT id FROM ci_hybrid_users WHERE id=$1 FOR UPDATE',[uid]);
      const pending=write(a,{opinione_95:'i'});
      await b.query('UPDATE ci_hybrid_users SET consent=false WHERE id=$1',[uid]);
      await b.query('DELETE FROM ci_hybrid_answers WHERE user_id=$1',[uid]);
      await b.query('COMMIT');
      assert.equal(await pending,'no-consent');
      assert.equal((await a.query('SELECT 1 FROM ci_hybrid_answers WHERE user_id=$1',[uid])).rowCount,0);
      assert.equal(await schemaCount(a),before);
    });
    await t.test('account deletion cascades existing and new answers on same row',async()=>{
      // In this disposable fixture a user re-grant creates fresh empty data.
      await a.query('UPDATE ci_hybrid_users SET consent=true WHERE id=$1',[uid]);
      assert.equal(await write(a,{opinione_95:'c'}),'saved');
      await a.query('DELETE FROM ci_hybrid_users WHERE id=$1',[uid]);
      assert.equal((await a.query('SELECT 1 FROM ci_hybrid_answers WHERE user_id=$1',[uid])).rowCount,0);
    });
  }finally{
    await a.query('DROP TABLE IF EXISTS ci_hybrid_answers');
    await a.query('DROP TABLE IF EXISTS ci_hybrid_users');
    await b.end();
    await a.end();
  }
});
