'use strict';
// Research-only PostgreSQL 17 benchmark; no DEMOS data or Supabase connection.
const assert=require('node:assert/strict');
const {Client}=require('pg');
// Pinned fixed 2-bit codec from PR #247; never copied into runtime.
const {encodeAnswers,decodeAnswers}=require('../../_ci_op247/api/utils/opinionBitset');
const uri=process.env.OPINION_V2_PG_CI_URL;
if(!uri || process.env.GITHUB_ACTIONS!=='true')throw Error('Ephemeral CI only');
const u=new URL(uri);
if(!['localhost','127.0.0.1','::1'].includes(u.hostname) ||
   u.pathname!=='/opinion_answers_ci')throw Error('Refusing non-ephemeral DB');

const USERS=1200, QUESTIONS=94;
const TABLES=['ci_sources_bench_legacy','ci_sources_bench_v2',
  'ci_sources_bench_fixed','ci_sources_bench_fixture'];
const labels=Array.from({length:QUESTIONS},(_,i)=>'opinione_'+i);
const ident=i=>'"'+labels[i]+'"';
const sourceText='https://example.invalid/research/'+'synthetic-'.repeat(6);
const percentile=(xs,p)=>{
  const items=[...xs].sort((a,b)=>a-b);
  return Math.round(items[Math.ceil(p*items.length)-1]*1000)/1000;
};
async function measure(client,sql,params=[]){
  const r=await client.query('EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) '+sql,params);
  return Number(r.rows[0]['QUERY PLAN'][0]['Execution Time']);
}
async function getSize(db,table){
  const r=await db.query('SELECT pg_total_relation_size($1::regclass)::bigint AS size',[table]);
  return Number(r.rows[0].size);
}
async function walStart(db){
  const r=await db.query('SELECT pg_current_wal_insert_lsn() AS lsn');
  return r.rows[0].lsn;
}
async function walSince(db,before){
  const r=await db.query('SELECT pg_wal_lsn_diff(pg_current_wal_insert_lsn(), $1::pg_lsn)::bigint AS bytes',[before]);
  return Number(r.rows[0].bytes);
}
async function drop(db){
  for(const t of TABLES)await db.query('DROP TABLE IF EXISTS '+t);
}
async function run(){
  const db=new Client({connectionString:uri,connectionTimeoutMillis:5000});
  await db.connect();
  const output=[];
  try{
    for(const cfg of [
      {answerDensity:9,sourceShareOfAnswers:20},
      {answerDensity:45,sourceShareOfAnswers:40}
    ]){
      await drop(db);
      await db.query('CREATE TABLE ci_sources_bench_fixture(user_id integer NOT NULL,'+
        'opinion_id text NOT NULL, answer text NOT NULL, source_text text,'+
        'PRIMARY KEY(user_id,opinion_id))');
      await db.query(
        'INSERT INTO ci_sources_bench_fixture(user_id,opinion_id,answer,source_text) '+
        "SELECT g, 'opinione_'||i, CASE ((g*37+i*17)%3) "+
        "WHEN 0 THEN 'f' WHEN 1 THEN 'c' ELSE 'i' END,"+
        'CASE WHEN ((g*17+i*7)%100)<'+cfg.sourceShareOfAnswers+
        ' THEN $1::text || i::text ELSE NULL END '+
        'FROM generate_series(1,'+USERS+') g CROSS JOIN '+
        'generate_series(0,'+(QUESTIONS-1)+') i '+
        'WHERE ((g*13+i*19)%100)<'+cfg.answerDensity,
        [sourceText]
      );
      await db.query('CREATE TABLE ci_sources_bench_legacy ('+
        'user_id integer PRIMARY KEY,'+
        labels.map((_,i)=>ident(i)+' text').join(',')+
        ",fonti_opinioni jsonb NOT NULL DEFAULT '{}'::jsonb)");
      await db.query('CREATE TABLE ci_sources_bench_v2 ('+
        'user_id integer PRIMARY KEY,'+
        "answers jsonb NOT NULL DEFAULT '{}'::jsonb,"+
        "sources jsonb NOT NULL DEFAULT '{}'::jsonb)");
      await db.query('CREATE TABLE ci_sources_bench_fixed ('+
        'user_id integer PRIMARY KEY,catalog_version integer NOT NULL,'+
        "answers bytea NOT NULL,sources jsonb NOT NULL DEFAULT '{}'::jsonb)");
      await db.query(
        'INSERT INTO ci_sources_bench_legacy(user_id,'+labels.map((_,i)=>ident(i)).join(',')+
        ') SELECT g,'+
        labels.map(id=>"MAX(f.answer) FILTER (WHERE f.opinion_id='"+id+"')").join(',')+
        ' FROM generate_series(1,'+USERS+') g '+
        'LEFT JOIN ci_sources_bench_fixture f ON f.user_id=g GROUP BY g'
      );
      await db.query(
        'INSERT INTO ci_sources_bench_v2(user_id,answers,sources) '+
        "SELECT g, COALESCE(jsonb_object_agg(f.opinion_id,f.answer) "+
        "FILTER(WHERE f.opinion_id IS NOT NULL),'{}'::jsonb),"+
        "COALESCE(jsonb_object_agg(f.opinion_id,f.source_text) "+
        "FILTER(WHERE f.source_text IS NOT NULL),'{}'::jsonb) "+
        'FROM generate_series(1,'+USERS+') g '+
        'LEFT JOIN ci_sources_bench_fixture f ON f.user_id=g GROUP BY g'
      );
      // Same synthetic data, encoded using the pinned PR #247 fixed bitset.
      const snapshots=await db.query('SELECT user_id,answers,sources FROM ci_sources_bench_v2 ORDER BY user_id');
      for(let at=0;at<snapshots.rows.length;at+=100){
        const batch=snapshots.rows.slice(at,at+100),params=[],parts=[];
        for(const row of batch){
          const n=params.length;
          params.push(row.user_id,1,encodeAnswers(labels,row.answers),JSON.stringify(row.sources));
          parts.push('($'+(n+1)+',$'+(n+2)+',$'+(n+3)+',$'+(n+4)+'::jsonb)');
        }
        await db.query('INSERT INTO ci_sources_bench_fixed '+
          '(user_id,catalog_version,answers,sources) VALUES '+parts.join(','),params);
      }
      const samples=await db.query(
        'SELECT b.answers,b.sources,v.answers AS json_answers,v.sources AS json_sources '+
        'FROM ci_sources_bench_fixed b JOIN ci_sources_bench_v2 v USING(user_id) '+
        'WHERE b.user_id IN(1,500,1200)'
      );
      for(const row of samples.rows){
        const decoded=decodeAnswers(labels,row.answers);
        for(const id of labels)assert.equal(decoded[id],row.json_answers[id]??null);
        assert.deepEqual(row.sources,row.json_sources);
      }
      await db.query(
        'UPDATE ci_sources_bench_legacy l SET fonti_opinioni=v.sources '+
        'FROM ci_sources_bench_v2 v WHERE l.user_id=v.user_id'
      );
      const proof=await db.query(
        'SELECT COUNT(*)::integer AS mismatches FROM ci_sources_bench_v2 v '+
        'JOIN ci_sources_bench_legacy l ON v.user_id=l.user_id '+
        'WHERE v.sources IS DISTINCT FROM l.fonti_opinioni'
      );
      assert.equal(proof.rows[0].mismatches,0);
      const answerProof=await db.query(
        'SELECT COUNT(*)::integer AS mismatches FROM ci_sources_bench_fixture f '+
        'JOIN ci_sources_bench_v2 v ON v.user_id=f.user_id '+
        'JOIN ci_sources_bench_legacy l ON l.user_id=f.user_id '+
        'WHERE v.answers->>f.opinion_id IS DISTINCT FROM f.answer OR '+
        'to_jsonb(l)->>f.opinion_id IS DISTINCT FROM f.answer'
      );
      assert.equal(answerProof.rows[0].mismatches,0);
      for(const t of TABLES.slice(0,2))await db.query('ANALYZE '+t);
      const metric={users:USERS,opinions:QUESTIONS,...cfg,
        bytes:{legacy:await getSize(db,'ci_sources_bench_legacy'),
          v2:await getSize(db,'ci_sources_bench_v2'),
          fixed:await getSize(db,'ci_sources_bench_fixed')},
        readsMs:{},updateWalBytes:{},updatedRows:80,
        sourceTextBytes:Buffer.byteLength(sourceText+'93','utf8'),
        identicalAnswersAndSources:true};
      const sql={
        legacy:'SELECT * FROM ci_sources_bench_legacy WHERE user_id=$1',
        v2:'SELECT answers,sources FROM ci_sources_bench_v2 WHERE user_id=$1',
        fixed:'SELECT catalog_version,answers,sources FROM ci_sources_bench_fixed WHERE user_id=$1'
      };
      for(const kind of ['legacy','v2','fixed']){
        const times=[];
        for(let i=0;i<12;i++)times.push(await measure(db,sql[kind],[500]));
        metric.readsMs[kind]={p50:percentile(times,.5),p95:percentile(times,.95)};
      }
      // Sequential identical 80 answer+source changes, one PostgreSQL
      // instance. WAL values are illustrative, not production forecast.
      const update={
        legacy:'UPDATE ci_sources_bench_legacy SET "opinione_7"=$2,'+
          "fonti_opinioni=fonti_opinioni||jsonb_build_object('opinione_7',$3::text) "+
          'WHERE user_id=$1',
        v2:'UPDATE ci_sources_bench_v2 SET '+
          "answers=answers||jsonb_build_object('opinione_7',$2::text),"+
          "sources=sources||jsonb_build_object('opinione_7',$3::text) "+
          'WHERE user_id=$1',
        fixed:'UPDATE ci_sources_bench_fixed SET '+
          'answers=set_byte(answers,1,(get_byte(answers,1)&252)|'+
          "CASE $2::text WHEN 'f' THEN 1 WHEN 'c' THEN 2 WHEN 'i' THEN 3 ELSE 0 END),"+
          "sources=sources||jsonb_build_object('opinione_7',$3::text) "+
          'WHERE user_id=$1'
      };
      for(const kind of ['legacy','v2','fixed']){
        const lsn=await walStart(db);
        for(let id=1;id<=80;id++){
          const res=await db.query(update[kind],[id,'i',sourceText+'update']);
          assert.equal(res.rowCount,1);
        }
        metric.updateWalBytes[kind]=await walSince(db,lsn);
      }
      const post=await db.query(
        'SELECT count(*)::integer AS mismatches FROM ci_sources_bench_legacy l '+
        'JOIN ci_sources_bench_v2 v ON l.user_id=v.user_id '+
        'WHERE l.fonti_opinioni IS DISTINCT FROM v.sources OR '+
        "l.\"opinione_7\" IS DISTINCT FROM v.answers->>'opinione_7'"
      );
      assert.equal(post.rows[0].mismatches,0);
      const fixedPost=await db.query(
        'SELECT COUNT(*)::integer AS mismatches FROM ci_sources_bench_fixed b '+
        'JOIN ci_sources_bench_v2 v USING(user_id) '+
        'WHERE b.sources IS DISTINCT FROM v.sources OR '+
        "(get_byte(b.answers,1)&3) IS DISTINCT FROM CASE v.answers->>'opinione_7' "+
        "WHEN 'f' THEN 1 WHEN 'c' THEN 2 WHEN 'i' THEN 3 ELSE 0 END"
      );
      assert.equal(fixedPost.rows[0].mismatches,0);
      metric.identicalAfter80Updates=true;
      output.push(metric);
    }
    console.log('OPINION_V2_SOURCES_BENCHMARK_JSON='+JSON.stringify(output));
  }finally{
    await drop(db);
    await db.end();
  }
}
run().catch(e=>{
  console.error('Sources benchmark failed',e.code||e.name||'UNKNOWN',e.message);
  process.exitCode=1;
});
