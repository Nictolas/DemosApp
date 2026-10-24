'use strict';

/**
 * DOC-067: read-only synthetic workload measurements after fixture seeding.
 * Accounts grow from 1k to 10k to 50k in a disposable PostgreSQL 17 CI DB.
 * This is NOT a capacity / cost prediction for Supabase Free or 1m users.
 */
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {Client,Pool}=require('pg');
const {
  getNationalSurveyStats,getTerritorialSurveyStats,
  buildNationalTextAggregateQuery
}=require('../utils/sondaggiTextBulk');

const DB='sondaggi_scale_ci';
const SIZES=[1000,10000,50000];
const OPINIONS=94;
const IDS=Array.from({length:OPINIONS},(_,i)=>
  'synthetic_opinion_'+String(i).padStart(3,'0'));
const QUESTIONS=IDS.map(id=>({id,text:id}));
const REPETITIONS=7;
const SCOPES=[
 {name:'national'},
 {name:'region',scope:'regione',params:['TO']},
 {name:'province',scope:'provincia',params:['TO','PI']},
 {name:'municipality',scope:'comune',params:['TO','PI','Pisa']}
];
const inputGuard=()=>{
 const e=process.env;
 if(e.GITHUB_ACTIONS!=='true'||e.SONDAGGI_TEXT_CI!=='isolated'||
  e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
  e.PGUSER!=='postgres'||e.PGPASSWORD!=='synthetic-only'||
  e.PGDATABASE!=='sondaggi_text_ci')
    throw Error('DOC-067 refuses nonisolated PostgreSQL17 test environment');
};
const config=database=>({host:'127.0.0.1',port:5432,database,
 user:'postgres',password:'synthetic-only',max:3,
 statement_timeout:19000,connectionTimeoutMillis:3500,
 application_name:'doc067_synthetic_scale_ci'});
const round=n=>Number(n.toFixed(3));
const percentile=(a,p)=>{
 const arr=[...a].sort((x,y)=>x-y);
 return round(arr[Math.max(0,Math.ceil(arr.length*p)-1)]);
};
const summary=a=>({
 runs:a.length,meanMs:round(a.reduce((x,y)=>x+y,0)/a.length),
 p50Ms:percentile(a,.5),p95Ms:percentile(a,.95),
 maxMs:percentile(a,1)
});
const uid="('00000000-0000-4000-8003-'||lpad(g::text,12,'0'))::uuid";
async function makeDb(){
 const c=new Client(config('postgres'));
 await c.connect();
 try{
  const probe=(await c.query(
   "SELECT current_database() db,current_setting('server_version_num')::int v")).rows[0];
  assert.equal(probe.db,'postgres');
  assert.equal(Math.floor(probe.v/10000),17);
  await c.query('CREATE DATABASE '+DB);
 }finally{await c.end();}
}
async function makeTables(db){
 await db.query('CREATE TABLE users ('+
  'id uuid PRIMARY KEY,account_type text NOT NULL,'+
  'political_opinions_consent boolean,regione_residenza text,'+
  'provincia_residenza text,comune_residenza text)');
 await db.query('CREATE TABLE user_consents ('+
  'user_id uuid PRIMARY KEY,political_opinions_consent boolean)');
 await db.query('CREATE TABLE opinioni_risposte ('+
  'user_id uuid PRIMARY KEY,'+
  IDS.map(id=>'"'+id+'" text').join(',')+')');
 await db.query('CREATE TABLE opinioni_domande ('+
  'id text PRIMARY KEY,text text NOT NULL,gradi_opinione text[])');
 await db.query("INSERT INTO opinioni_domande (id,text,gradi_opinione) VALUES "+
  IDS.map((id,i)=>"('"+id+"','Synthetic "+i+
   "',"+(i===92?"ARRAY['da approvare']":"ARRAY['N']")+")").join(','));
}
const answers=IDS.map((_,i)=>
 "CASE WHEN (g+"+i+"*7)%12=0 THEN CASE (g+"+i+
 ")%3 WHEN 0 THEN 'f' WHEN 1 THEN 'c' ELSE 'i' END ELSE NULL END");
async function extend(db,min,max){
 for(let start=min;start<=max;start+=2000){
  const end=Math.min(start+1999,max);
  await db.query('INSERT INTO users '+
   '(id,account_type,political_opinions_consent,'+
   'regione_residenza,provincia_residenza,comune_residenza) '+
   'SELECT '+uid+','+
   "CASE WHEN g%17=0 THEN 'ORGANIZATION' ELSE 'PERSON' END,"+
   "g%13<>0,CASE WHEN g%3=0 THEN 'TO' ELSE 'LO' END,"+
   "CASE WHEN g%3=0 THEN 'PI' ELSE 'MI' END,"+
   "CASE WHEN g%3=0 THEN 'Pisa' ELSE 'Milano' END "+
   'FROM generate_series($1::int,$2::int) g',[start,end]);
  await db.query('INSERT INTO opinioni_risposte(user_id,'+
   IDS.map(id=>'"'+id+'"').join(',')+') '+
   'SELECT '+uid+','+answers.join(',')+
   ' FROM generate_series($1::int,$2::int) g',[start,end]);
  await db.query('INSERT INTO user_consents(user_id,political_opinions_consent) '+
   'SELECT '+uid+',false FROM generate_series($1::int,$2::int) g '+
   'WHERE g%29=0',[start,end]);
 }
 await db.query('ANALYZE users');
 await db.query('ANALYZE user_consents');
 await db.query('ANALYZE opinioni_risposte');
}
async function read(db,scope){
 const wrapper={calls:0,async query(...args){
  this.calls++;return db.query(...args);
 }};
 const start=performance.now();
 const questions=(await wrapper.query(
  "SELECT id,text FROM opinioni_domande WHERE NOT ('da approvare'=ANY(gradi_opinione)) ORDER BY text")).rows;
 const stats=scope.scope?
  await getTerritorialSurveyStats(wrapper,questions,
   {scope:scope.scope,params:scope.params}):
  await getNationalSurveyStats(wrapper,questions);
 const elapsed=performance.now()-start;
 assert.equal(questions.length,93);
 assert.equal(wrapper.calls,3,'catalog + whitelist + one grouped SQL');
 assert.ok(Object.keys(stats).length<=93);
 for(const values of Object.values(stats)){
  assert.ok(values.favorevole+values.contrario+values.indeciso>=10);
 }
 return {elapsed,questions:wrapper.calls,publications:Object.keys(stats).length};
}

// Experimental SQL-only candidate: aggregate f/c/i across eligible people
// directly before pivoting one result row per opinion. Compare with the
// existing lateral-per-person implementation; do not publish the candidate
// as app code until relative performance is measured.
function directFilterAggregateSql(columns){
 const names=columns.map((id,i)=>({
   id,f:'f'+i,c:'c'+i,u:'i'+i
 }));
 const checks=names.flatMap(({id,f,c,u})=>[
  "COUNT(*) FILTER (WHERE orr.\""+id+"\" = 'f')::integer AS "+f,
  "COUNT(*) FILTER (WHERE orr.\""+id+"\" = 'c')::integer AS "+c,
  "COUNT(*) FILTER (WHERE orr.\""+id+"\" = 'i')::integer AS "+u
 ]);
 const points=names.map(({id,f,c,u})=>
  "('"+id+"', counts."+f+", counts."+c+", counts."+u+")");
 return "SELECT v.opinion_id,v.favorevole,v.contrario,v.indeciso FROM ("+
  "SELECT "+checks.join(',')+
  " FROM opinioni_risposte orr JOIN users u ON u.id=orr.user_id "+
  "LEFT JOIN user_consents uc ON uc.user_id=u.id "+
  "WHERE u.account_type='PERSON' AND "+
  "COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE"+
  ") counts CROSS JOIN LATERAL (VALUES "+
  points.join(',')+") AS v(opinion_id,favorevole,contrario,indeciso) "+
  "WHERE (v.favorevole+v.contrario+v.indeciso)>0";
}
function normalizeStatRows(rows){
 return Object.fromEntries(rows.map(r=>[r.opinion_id,
  [Number(r.favorevole),Number(r.contrario),Number(r.indeciso)]])
  .sort((a,b)=>a[0].localeCompare(b[0])));
}
async function compareAlternativeSql(db){
 const ids=IDS.filter(id=>id!=='synthetic_opinion_092');
 const currentSql=buildNationalTextAggregateQuery(ids);
 const candidateSql=directFilterAggregateSql(ids);
 const original=normalizeStatRows((await db.query(currentSql)).rows);
 const proposed=normalizeStatRows((await db.query(candidateSql)).rows);
 assert.deepEqual(proposed,original,
  'Direct-filter candidate must exactly match consent-aware grouped query');
 const timings={current:[],candidate:[]};
 for(let i=0;i<7;i++){
  const order=i%2===0?['current','candidate']:['candidate','current'];
  for(const mode of order){
   const sql=mode==='current'?currentSql:candidateSql;
   const start=performance.now();
   const data=await db.query(sql);
   const elapsed=performance.now()-start;
   assert.deepEqual(normalizeStatRows(data.rows),original,
    'Direct-filter candidate response drift in '+mode);
   timings[mode].push(elapsed);
  }
 }
 return {
  current:summary(timings.current),
  candidate:summary(timings.candidate),
  candidateP50RelativeToCurrent:round(
   percentile(timings.candidate,.5)/percentile(timings.current,.5)),
  matchingConsentAndCounts:true,
  experimentalOnly:true
 };
}

async function main(){
 inputGuard();
 await makeDb();
 const db=new Pool(config(DB));
 try{
  await makeTables(db);
  let previous=0;
  const datasets=[];
  for(const size of SIZES){
   await extend(db,previous+1,size);
   previous=size;
   const count=(await db.query('SELECT count(*)::int n FROM users')).rows[0].n;
   assert.equal(count,size);
   const measurements=[];
   for(const scope of SCOPES){
    await read(db,scope); // warmup excluded
    const durations=[],published=[];
    for(let i=0;i<REPETITIONS;i++){
     const result=await read(db,scope);
     durations.push(result.elapsed);
     published.push(result.publications);
    }
    assert.equal(new Set(published).size,1);
    measurements.push({scope:scope.name,queries:3,
     publishedOpinions:published[0],...summary(durations)});
   }
   const sizes=(await db.query(
    "SELECT pg_total_relation_size('opinioni_risposte'::regclass)::bigint bytes")).rows[0];
   datasets.push({
    accounts:count,responseTableBytes:Number(sizes.bytes),
    scopes:measurements
   });
  }
  // EXPLAIN is recorded for diagnostics, not used to infer a 1m-account SLA.
  const explain=(await db.query(
   'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+
   buildNationalTextAggregateQuery(IDS.filter(x=>x!=='synthetic_opinion_092'))
  )).rows[0]['QUERY PLAN'][0];
  const planner={
   nodeType:explain.Plan['Node Type'],
   actualExecutionMs:round(explain['Execution Time']),
   sharedHitBlocks:explain.Plan['Shared Hit Blocks'],
   sharedReadBlocks:explain.Plan['Shared Read Blocks'],
   rows:explain.Plan['Actual Rows']
  };
  const candidateComparison=await compareAlternativeSql(db);
  console.log('SONDAGGI_TEXT_SCALE_CI_PASS');
  console.log('SONDAGGI_TEXT_SCALE_CI_RESULT_JSON='+JSON.stringify({
   postgres:17,synthetic:true,
   answerDensityApprox:'1/12; synthetic sparse TEXT',
   scenarios:SIZES,durationsMeasuredPerScope:REPETITIONS,
   datasets,planner,candidateComparison,
   limitations:[
    'CI-only PostgreSQL17 and Node on the same host; not Supabase staging.',
    'Synthetic sparsity/consent/geography does not reproduce production distribution.',
    'Seven timed sequential calls per scope have unstable p95 estimates.',
    'No HTTP WAN, authentication, RLS production, parallel-user load, or dollar billing.',
    'Cannot extrapolate to one million users or free-tier capacity.'
   ],
   noSupabase:true,noProductionWrites:true
  }));
 }finally{await db.end();}
}
main().catch(e=>{
 console.error('DOC067 synthetic scaling benchmark failed:',e);
 process.exitCode=1;
});
