'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {SQL,planSourcePatch,validateSourceMap}=
  require('../experiments/opinionAnswersV2SourcesCandidate');
const {projectV2GdprExport}=
  require('../experiments/opinionAnswersV2GdprCandidate');

// Synthetic only: never connect to actual Supabase, Render or staging.
const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri && process.env.GITHUB_ACTIONS==='true');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const published=new Set(['opinione_0','opinione_1','opinione_94']);
const safeUrl=()=>{
  const u=new URL(uri);
  if(!['127.0.0.1','localhost','::1'].includes(u.hostname) ||
     u.pathname!=='/opinion_answers_ci' ||
     process.env.GITHUB_ACTIONS!=='true')throw Error('Refusing nonlocal/non-ephemeral DB');
};
const upsert=SQL.upsertSources.replaceAll(
  'demos_private.opinion_answer_maps_v2','ci_v2_sources'
);
async function patch(db,userId,changes) {
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL lock_timeout='5s'");
    const locked=await db.query('SELECT id FROM ci_v2_source_users WHERE id=$1 FOR UPDATE',[userId]);
    if(!locked.rowCount){await db.query('ROLLBACK');return 'missing';}
    // Separate statement AFTER acquiring same lock as consent revocation.
    const auth=await db.query('SELECT consent FROM ci_v2_source_users WHERE id=$1',[userId]);
    if(auth.rows[0].consent!==true){await db.query('ROLLBACK');return 'no-consent';}
    const old=await db.query('SELECT sources FROM ci_v2_sources WHERE user_id=$1 FOR UPDATE',[userId]);
    const plan=planSourcePatch(old.rows[0]?.sources||{},changes,published);
    if(!plan.changedCount){await db.query('COMMIT');return 'unchanged';}
    await db.query(upsert,[userId,JSON.stringify(plan.added),plan.removed]);
    await db.query('COMMIT');
    return 'changed';
  }catch(error){await db.query('ROLLBACK');throw error;}
}
async function sources(db,id) {
  const r=await db.query('SELECT sources FROM ci_v2_sources WHERE user_id=$1',[id]);
  return r.rows[0]?.sources||null;
}
test('synthetic PG17: sources preserve history, only patch named keys, enforce consent',
  {skip:!enabled},async t=>{
  safeUrl();
  const a=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  const b=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  await a.connect();
  try {
    await b.connect();
    await a.query('DROP TABLE IF EXISTS ci_v2_sources');
    await a.query('DROP TABLE IF EXISTS ci_v2_source_users');
    await a.query('CREATE TABLE ci_v2_source_users(id uuid PRIMARY KEY,consent boolean NOT NULL)');
    await a.query(
      "CREATE TABLE ci_v2_sources(user_id uuid PRIMARY KEY REFERENCES ci_v2_source_users(id),"+
      "answers jsonb NOT NULL DEFAULT '{}'::jsonb, "+
      "sources jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(sources)='object'),"+
      "updated_at timestamptz NOT NULL DEFAULT now())"
    );
    await a.query('INSERT INTO ci_v2_source_users VALUES($1,true),($2,true)',[uid(41),uid(42)]);
    await a.query('INSERT INTO ci_v2_sources(user_id,answers,sources) VALUES($1,$2::jsonb,$3::jsonb)',
      [uid(41),JSON.stringify({opinione_0:'f',opinione_archiviata:'i'}),
        JSON.stringify({opinione_0:'fonte originale',opinione_archiviata:'fonte storica'})]);
    await t.test('profile source change preserves other and archived values',async()=>{
      assert.equal(await patch(a,uid(41),{opinione_0:'fonte aggiornata'}),'changed');
      assert.deepEqual(await sources(a,uid(41)),{
        opinione_0:'fonte aggiornata',opinione_archiviata:'fonte storica'
      });
      assert.equal(await patch(a,uid(41),{opinione_0:'fonte aggiornata'}),'unchanged');
    });
    await t.test('source-only 95th opinion works without a SQL column',async()=>{
      assert.equal(await patch(a,uid(41),{opinione_94:'nuovo testo'}),'changed');
      assert.equal((await sources(a,uid(41))).opinione_94,'nuovo testo');
      assert.deepEqual(await (async()=>{
        const r=await a.query("SELECT answers FROM ci_v2_sources WHERE user_id=$1",[uid(41)]);
        return r.rows[0].answers;
      })(), {opinione_0:'f',opinione_archiviata:'i'});
    });
    await t.test('one-key removal uses JSONB minus and preserves unrelated fields',async()=>{
      assert.equal(await patch(a,uid(41),{opinione_0:'   '}),'changed');
      assert.deepEqual(await sources(a,uid(41)),{
        opinione_archiviata:'fonte storica',opinione_94:'nuovo testo'
      });
    });
    await t.test('another user cannot be affected by the subject-only patch',async()=>{
      assert.equal(await patch(b,uid(42),{opinione_1:'independent'}),'changed');
      assert.deepEqual(await sources(b,uid(42)),{opinione_1:'independent'});
      assert.equal((await sources(a,uid(41))).opinione_1,undefined);
    });
    await t.test('transaction rollback reverts changes to sources and answers',async()=>{
      await a.query('BEGIN');
      try {
        await a.query('SELECT id FROM ci_v2_source_users WHERE id=$1 FOR UPDATE',[uid(41)]);
        await a.query('UPDATE ci_v2_sources SET answers=answers||$2::jsonb WHERE user_id=$1',
          [uid(41),'{"opinione_0":"c"}']);
        await a.query(upsert,[uid(41),'{"opinione_1":"rollback"}',[]]);
        await assert.rejects(a.query('SELECT 1/0'),/division by zero/);
        await a.query('ROLLBACK');
      }catch(e){await a.query('ROLLBACK');throw e;}
      const row=await a.query('SELECT answers,sources FROM ci_v2_sources WHERE user_id=$1',[uid(41)]);
      assert.equal(row.rows[0].answers.opinione_0,'f');
      assert.equal(row.rows[0].sources.opinione_1,undefined);
    });
    await t.test('GDPR export can include archived answer and source in one row',async()=>{
      const r=await a.query('SELECT user_id,answers,sources FROM ci_v2_sources WHERE user_id=$1',[uid(41)]);
      const exported=projectV2GdprExport(uid(41),r.rows[0]);
      assert.equal(exported.answer_sources_included,true);
      assert.deepEqual({...exported.answers_by_id},{
        opinione_0:'f',opinione_archiviata:'i'
      });
      assert.deepEqual({...exported.sources_by_id},{
        opinione_94:'nuovo testo',opinione_archiviata:'fonte storica'
      });
      assert.throws(()=>projectV2GdprExport(uid(42),r.rows[0]),/SUBJECT_MISMATCH/);
    });
    await t.test('revoked consent blocks writes and existing source deleted in same transaction',async()=>{
      await b.query('BEGIN');
      await b.query('SELECT id FROM ci_v2_source_users WHERE id=$1 FOR UPDATE',[uid(41)]);
      await b.query('UPDATE ci_v2_source_users SET consent=false WHERE id=$1',[uid(41)]);
      await b.query('DELETE FROM ci_v2_sources WHERE user_id=$1',[uid(41)]);
      await b.query('COMMIT');
      assert.equal(await patch(a,uid(41),{opinione_0:'must not appear'}),'no-consent');
      assert.equal(await sources(a,uid(41)),null);
    });
    await t.test('stored sources reject malformed JSONB values',()=>{
      assert.deepEqual({...validateSourceMap({opinione_0:'text'})},{opinione_0:'text'});
      assert.throws(()=>validateSourceMap({opinione_0:{nested:'not allowed'}}),/Invalid stored/);
    });
  }finally{
    await a.query('DROP TABLE IF EXISTS ci_v2_sources');
    await a.query('DROP TABLE IF EXISTS ci_v2_source_users');
    await b.end();
    await a.end();
  }
});
