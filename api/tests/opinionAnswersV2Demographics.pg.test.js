'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {
  buildHybridDemographicQuery,publishHybridDemographicBreakdown
}=require('../experiments/opinionAnswersV2DemographicsCandidate');

const uri=process.env.OPINION_V2_PG_CI_URL;
const enabled=Boolean(uri&&process.env.GITHUB_ACTIONS==='true');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const legacy=['opinione_0'];
const published=new Set(['opinione_0','opinione_94']);
const tables=['ci_demo_stats_answers','ci_demo_stats_consents','ci_demo_stats_users'];
function guard(){
  if(!enabled)throw Error('CI only');
  const u=new URL(uri);
  if(!['localhost','127.0.0.1','::1'].includes(u.hostname)||
     u.pathname!=='/opinion_answers_ci')throw Error('Non-ephemeral database refused');
}
async function breakdown(db,opinionId,dimension,region){
  const built=buildHybridDemographicQuery({
    opinionId,publishedIds:published,legacyIds:legacy,dimension,region
  });
  const sql=built.sql
    .replaceAll('FROM opinioni_risposte orr','FROM ci_demo_stats_answers orr')
    .replaceAll('JOIN users u','JOIN ci_demo_stats_users u')
    .replaceAll('JOIN user_consents uc','JOIN ci_demo_stats_consents uc');
  const query=await db.query(sql,built.params);
  return publishHybridDemographicBreakdown(query.rows,dimension);
}
async function drop(db){
  for(const t of tables)await db.query('DROP TABLE IF EXISTS '+t);
}
test('PG17 hybrid detailed opinion statistics: demographic/consent privacy',
  {skip:!enabled},async t=>{
  guard();
  const db=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  await db.connect();
  try{
    await drop(db);
    await db.query('CREATE TABLE ci_demo_stats_users ('+
      'id uuid PRIMARY KEY,account_type text NOT NULL,'+
      'political_opinions_consent boolean NOT NULL,'+
      'data_nascita date, sesso text,regione_residenza text)');
    await db.query('CREATE TABLE ci_demo_stats_consents ('+
      'user_id uuid PRIMARY KEY REFERENCES ci_demo_stats_users(id),'+
      'political_opinions_consent boolean)');
    await db.query('CREATE TABLE ci_demo_stats_answers ('+
      'user_id uuid PRIMARY KEY REFERENCES ci_demo_stats_users(id),'+
      '"opinione_0" text,answers_extra jsonb)');
    // Livorno/Toscana: 10 M aged 18..25, 9 F aged 26..35,
    // one more F with EXPLICITLY revoked consent (subject 20).
    // Lazio: one consenting M aged 18..25. An organization is excluded.
    for(let n=1;n<=22;n++){
      const male=n<=10||n===22;
      const age=male?'2003-03-15':'1996-03-15';
      const tipo=n===21?'O':n%2===0?'P':'PERSON';
      const regione=n===22?'Lazio':'Toscana';
      const base=n!==10;
      await db.query('INSERT INTO ci_demo_stats_users VALUES($1,$2,$3,$4,$5,$6)',
        [uid(n),tipo,base,age,male?'M':'F',regione]);
      await db.query('INSERT INTO ci_demo_stats_answers VALUES($1,$2,$3::jsonb)',
        [uid(n),'f',JSON.stringify({opinione_94:'f',opinione_archived:'i'})]);
    }
    // Consent of 10 is explicit true, despite base false.
    // Consent of 20 is explicit false, despite base true.
    await db.query('INSERT INTO ci_demo_stats_consents VALUES($1,true),($2,false)',
      [uid(10),uid(20)]);

    await t.test('a 9-person F cell hides ENTIRE breakdown, not just F row',async()=>{
      for(const dimension of ['eta','sesso']){
        for(const opinionId of ['opinione_0','opinione_94']){
          const r=await breakdown(db,opinionId,dimension,'Toscana');
          assert.deepEqual(r,{success:true,minimumCellSize:10,suppressed:true,data:[]});
        }
      }
    });
    await t.test('explicit new consent makes 10 M and 10 F visible, in both formats',async()=>{
      await db.query('UPDATE ci_demo_stats_consents SET political_opinions_consent=true WHERE user_id=$1',[uid(20)]);
      for(const opinionId of ['opinione_0','opinione_94']){
        const ages=await breakdown(db,opinionId,'eta','Toscana');
        assert.equal(ages.suppressed,false);
        assert.deepEqual(ages.data.map(x=>x.fascia_eta),['18-25','26-35']);
        assert.deepEqual(ages.data.map(x=>x.favorevole+x.contrario+x.indeciso),[10,10]);
        const sexes=await breakdown(db,opinionId,'sesso','Toscana');
        assert.equal(sexes.suppressed,false);
        assert.deepEqual(sexes.data.map(x=>x.sesso),['F','M']);
        assert.deepEqual(sexes.data.map(x=>x.favorevole+x.contrario+x.indeciso),[10,10]);
      }
    });
    await t.test('ten-person demographic hides entire breakdown if just one answer is contrary',async()=>{
      const index=uid(19);
      await db.query(
        'UPDATE ci_demo_stats_answers SET "opinione_0"=$2, '+
        "answers_extra=jsonb_set(answers_extra,'{opinione_94}',to_jsonb($2::text)) "+
        'WHERE user_id=$1',[index,'c']
      );
      for(const dimension of ['eta','sesso']){
        const result=await breakdown(db,'opinione_94',dimension,'Toscana');
        assert.equal(result.suppressed,true);
        assert.deepEqual(result.data,[]);
      }
      await db.query(
        'UPDATE ci_demo_stats_answers SET "opinione_0"=$2, '+
        "answers_extra=jsonb_set(answers_extra,'{opinione_94}',to_jsonb($2::text)) "+
        'WHERE user_id=$1',[index,'f']
      );
    });
    await t.test('one-person region is fully hidden, national totals can be published',async()=>{
      const tiny=await breakdown(db,'opinione_94','sesso','Lazio');
      assert.deepEqual(tiny,{success:true,minimumCellSize:10,suppressed:true,data:[]});
      const national=await breakdown(db,'opinione_94','sesso');
      assert.equal(national.suppressed,false);
      assert.deepEqual(national.data.map(x=>x.favorevole+x.contrario+x.indeciso),[10,11]);
    });
    await t.test('region cannot be injected through a SQL parameter',async()=>{
      const bad=await breakdown(db,'opinione_94','eta',"Toscana' OR TRUE --");
      assert.deepEqual(bad,{success:true,minimumCellSize:10,suppressed:false,data:[]});
    });
    await t.test('revocation changes 10 to 9 and suppresses each detailed breakdown',async()=>{
      await db.query('BEGIN');
      try{
        await db.query('SELECT id FROM ci_demo_stats_users WHERE id=$1 FOR UPDATE',[uid(1)]);
        await db.query('UPDATE ci_demo_stats_users SET political_opinions_consent=false WHERE id=$1',[uid(1)]);
        await db.query('DELETE FROM ci_demo_stats_answers WHERE user_id=$1',[uid(1)]);
        await db.query('COMMIT');
      }catch(e){await db.query('ROLLBACK');throw e;}
      for(const dimension of ['eta','sesso']){
        const r=await breakdown(db,'opinione_94',dimension,'Toscana');
        assert.equal(r.suppressed,true);
        assert.deepEqual(r.data,[]);
      }
    });
    await t.test('archived ID cannot bypass published catalog',async()=>{
      await assert.rejects(()=>breakdown(db,'opinione_archived','sesso'),/immutable published/);
      const r=await db.query('SELECT answers_extra FROM ci_demo_stats_answers WHERE user_id=$1',[uid(2)]);
      assert.equal(r.rows[0].answers_extra.opinione_archived,'i');
    });
  }finally{
    await drop(db);
    await db.end();
  }
});
