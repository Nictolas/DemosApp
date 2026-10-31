'use strict';
// Isolated hybrid "94 legacy TEXT + one nullable JSONB overflow" benchmark.
// Never connect to Supabase or reuse personal answers. No DDL outside CI.
const assert=require('node:assert/strict');
const {Client}=require('pg');
const uri=process.env.OPINION_V2_PG_CI_URL;
if(!uri||process.env.GITHUB_ACTIONS!=='true')throw Error('CI only');
const target=new URL(uri);
if(!['127.0.0.1','localhost','::1'].includes(target.hostname) ||
    target.pathname!=='/opinion_answers_ci')throw Error('Non-ephemeral DB refused');
const USERS=1200,IDS=Array.from({length:94},(_,i)=>'opinione_'+i);
const TABLES=['ci_hybrid_bench_variant','ci_hybrid_bench_base'];
const quote=x=>'"'+x+'"';
async function size(db,t){
  const r=await db.query('SELECT pg_total_relation_size($1::regclass)::bigint AS n',[t]);
  return Number(r.rows[0].n);
}
async function countColumns(db,t){
  const r=await db.query(
    'SELECT count(*)::int AS n FROM information_schema.columns '+
    "WHERE table_schema='public' AND table_name=$1",[t]);
  return r.rows[0].n;
}
async function times(db,t){
  const samples=[];
  for(let i=0;i<12;i++){
    const r=await db.query(
      'EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM '+t+' WHERE user_id=500'
    );
    samples.push(Number(r.rows[0]['QUERY PLAN'][0]['Execution Time']));
  }
  samples.sort((a,b)=>a-b);
  return Math.round(samples[5]*1000)/1000;
}
async function drop(db){
  for(const t of TABLES)await db.query('DROP TABLE IF EXISTS '+t);
}
async function main(){
  const db=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  await db.connect();
  const outputs=[];
  try{
    for(const setting of [
      {answerDensity:9,sourceShareOfAnswers:20},
      {answerDensity:45,sourceShareOfAnswers:40}
    ]){
      await drop(db);
      await db.query('CREATE TABLE ci_hybrid_bench_base('+
        'user_id integer PRIMARY KEY,'+
        IDS.map(x=>quote(x)+' text').join(',')+
        ",fonti_opinioni jsonb NOT NULL DEFAULT '{}'::jsonb)");
      await db.query('CREATE TABLE ci_hybrid_bench_variant ('+
        'LIKE ci_hybrid_bench_base INCLUDING ALL)');
      // One-time DDL that will NEVER be repeated for additional opinions.
      await db.query('ALTER TABLE ci_hybrid_bench_variant ADD COLUMN answers_extra jsonb');
      const answer=(i)=>{
        return 'CASE WHEN ((g*13+'+i+'*19)%100)<'+setting.answerDensity+
          ' THEN CASE ((g*37+'+i+'*17)%3) WHEN 0 THEN '+
          "'f' WHEN 1 THEN 'c' ELSE 'i' END ELSE NULL END";
      };
      const sources=
        "COALESCE((SELECT jsonb_object_agg('opinione_'||i, "+
        "'https://example.invalid/research/'||repeat('synthetic-',6)||i) "+
        'FROM generate_series(0,93) i WHERE '+
        '((g*13+i*19)%100)<'+setting.answerDensity+
        ' AND ((g*17+i*7)%100)<'+setting.sourceShareOfAnswers+
        "), '{}'::jsonb)";
      await db.query('INSERT INTO ci_hybrid_bench_base(user_id,'+
        IDS.map(quote).join(',')+',fonti_opinioni) SELECT g,'+
        IDS.map((_,i)=>answer(i)).join(',')+','+sources+
        ' FROM generate_series(1,'+USERS+') g');
      await db.query('INSERT INTO ci_hybrid_bench_variant '+
        'SELECT b.*,NULL::jsonb FROM ci_hybrid_bench_base b');
      await db.query('VACUUM(FULL,ANALYZE) ci_hybrid_bench_base');
      await db.query('VACUUM(FULL,ANALYZE) ci_hybrid_bench_variant');
      const original=await size(db,'ci_hybrid_bench_base');
      const before=await size(db,'ci_hybrid_bench_variant');
      const nColumns=await countColumns(db,'ci_hybrid_bench_variant');
      assert.equal(nColumns,97);
      // 10% of users answer two NEW questions; no second ALTER TABLE.
      const patch=JSON.stringify({opinione_94:'f',opinione_95:'c'});
      const r=await db.query(
        'UPDATE ci_hybrid_bench_variant '+
        "SET answers_extra=COALESCE(answers_extra,'{}'::jsonb)||$1::jsonb "+
        'WHERE user_id<=120',[patch]);
      assert.equal(r.rowCount,120);
      await db.query('VACUUM(FULL,ANALYZE) ci_hybrid_bench_variant');
      const after=await size(db,'ci_hybrid_bench_variant');
      assert.equal(await countColumns(db,'ci_hybrid_bench_variant'),nColumns);
      const data=await db.query(
        'SELECT COUNT(*)::int AS mismatches FROM ci_hybrid_bench_base b '+
        'JOIN ci_hybrid_bench_variant h USING(user_id) '+
        "WHERE to_jsonb(b) IS DISTINCT FROM (to_jsonb(h)-'answers_extra')"
      );
      assert.equal(data.rows[0].mismatches,0);
      const newAnswers=await db.query(
        "SELECT COUNT(*)::int AS n FROM ci_hybrid_bench_variant "+
        "WHERE answers_extra->>'opinione_94'='f' AND "+
        "answers_extra->>'opinione_95'='c'"
      );
      assert.equal(newAnswers.rows[0].n,120);
      outputs.push({
        users:USERS,legacyOpinions:94,newOpinionIds:2,
        usersWithNewAnswers:120,...setting,
        totalBytes:{legacy:original,hybridBeforeNewOpinions:before,
          hybridAfterNewOpinions:after},
        singleUserReadP50Ms:{
          legacy:await times(db,'ci_hybrid_bench_base'),
          hybrid:await times(db,'ci_hybrid_bench_variant')
        },
        unchangedLegacyAndSourceMaps:true,
        columnsBeforeAndAfterNewOpinion:nColumns
      });
    }
    console.log('OPINION_V2_HYBRID_BENCHMARK_JSON='+JSON.stringify(outputs));
  }finally{
    await drop(db);
    await db.end();
  }
}
main().catch(e=>{
  console.error('Hybrid benchmark failed',e.code||e.name||'UNKNOWN',e.message);
  process.exitCode=1;
});
