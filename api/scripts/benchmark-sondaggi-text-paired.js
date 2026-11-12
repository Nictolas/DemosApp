'use strict';
/**
 * OP-36/37 paired benchmark. Same invented PG17 CI data for both SQL paths.
 * Not Supabase staging: its public schema is currently empty.
 */
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {Pool}=require('pg');
const {getNationalSurveyStats,getTerritorialSurveyStats}=require('../utils/sondaggiTextBulk');
const {cellThresholdMet}=require('../utils/politicalAggregatePrivacy');
const DB='sondaggi_text_ci';
const IDS=Array.from({length:94},(_,i)=>'synthetic_opinion_'+String(i).padStart(3,'0'));
const REPS=12;
const SCOPES=[
 {name:'national',scope:null,params:[]},
 {name:'region',scope:'regione',params:['TO']},
 {name:'province',scope:'provincia',params:['TO','PI']},
 {name:'municipality',scope:'comune',params:['TO','PI','Pisa']}
];
const FILTERS={
 regione:'AND u.regione_residenza=$1',
 provincia:'AND u.regione_residenza=$1 AND u.provincia_residenza=$2',
 comune:'AND u.regione_residenza=$1 AND u.provincia_residenza=$2 AND u.comune_residenza=$3'
};
function guard(){
 const e=process.env;
 if(e.GITHUB_ACTIONS!=='true'||e.SONDAGGI_TEXT_CI!=='isolated'||
    e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
    e.PGDATABASE!==DB||e.PGUSER!=='postgres'||e.PGPASSWORD!=='synthetic-only')
   throw Error('Refusing benchmark outside isolated PG17 CI');
}
async function seed(db){
 const userId="('00000000-0000-4000-8001-'||lpad(g::text,12,'0'))::uuid";
 await db.query('INSERT INTO users '+
   '(id,account_type,political_opinions_consent,regione_residenza,provincia_residenza,comune_residenza) '+
   'SELECT '+userId+','+
   "CASE WHEN g%17=0 THEN CASE WHEN g%2=0 THEN 'O' ELSE 'ORGANIZATION' END ELSE CASE WHEN g%2=0 THEN 'P' ELSE 'PERSON' END END,"+
   "g%13<>0,CASE WHEN g%3=0 THEN 'TO' ELSE 'LO' END,"+
   "CASE WHEN g%3=0 THEN 'PI' ELSE 'MI' END,"+
   "CASE WHEN g%3=0 THEN 'Pisa' ELSE 'Milano' END "+
   'FROM generate_series(1000,1599) g');
 const answerFields=IDS.map((_,i)=>
   'CASE WHEN (g+'+i+'*7)%12=0 THEN CASE (g+'+i+')%3 '+
   "WHEN 0 THEN 'f' WHEN 1 THEN 'c' ELSE 'i' END ELSE NULL END");
 await db.query('INSERT INTO opinioni_risposte(user_id,'+
   IDS.map(s=>'"'+s+'"').join(',')+') SELECT '+userId+','+
   answerFields.join(',')+' FROM generate_series(1000,1599) g');
}
function pct(a,f){
 const s=[...a].sort((a,b)=>a-b);
 return +(s[Math.max(0,Math.ceil(f*s.length)-1)]).toFixed(3);
}
const summary=a=>({n:a.length,meanMs:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3),
 p50Ms:pct(a,.5),p95Ms:pct(a,.95),minMs:pct(a,0),maxMs:pct(a,1)});
function legacyQuery(id,scope){
 assert.ok(IDS.includes(id),'Unvalidated identifier');
 const col='"'+id+'"';
 const geo=scope.scope?FILTERS[scope.scope]:'';
 return 'SELECT COUNT(*) FILTER (WHERE orr.'+col+"='f') AS favorevole,"+
  'COUNT(*) FILTER (WHERE orr.'+col+"='c') AS contrario,"+
  'COUNT(*) FILTER (WHERE orr.'+col+"='i') AS indeciso "+
  'FROM opinioni_risposte orr JOIN users u ON u.id=orr.user_id '+
  'LEFT JOIN user_consents uc ON uc.user_id=u.id '+
  'WHERE orr.'+col+' IS NOT NULL '+
  "AND u.account_type IN ('PERSON','P') "+
  'AND COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE '+
  geo;
}
const published="SELECT id,text FROM opinioni_domande WHERE NOT ('da approvare'=ANY(gradi_opinione)) ORDER BY text";
async function oldRead(db,scope){
 const questions=(await db.query(published)).rows,stats={};
 for(const q of questions){
  const x=await db.query('SELECT column_name FROM information_schema.columns '+
   "WHERE table_name='opinioni_risposte' AND column_name=$1",[q.id]);
  if(!x.rows.length)continue;
  const row=(await db.query(legacyQuery(q.id,scope),scope.params)).rows[0];
  const tally={favorevole:Number(row.favorevole)||0,
   contrario:Number(row.contrario)||0,indeciso:Number(row.indeciso)||0};
  if(cellThresholdMet(tally))stats[q.id]=tally;
 }
 return {stats,questions};
}
async function newRead(db,scope){
 const questions=(await db.query(published)).rows;
 const failLogger={warn:(msg)=>{throw Error('Fallback not permitted in benchmark: '+msg)}};
 const stats=scope.scope?
   await getTerritorialSurveyStats(db,questions,{scope:scope.scope,params:scope.params},failLogger):
   await getNationalSurveyStats(db,questions,failLogger);
 return {stats,questions};
}
async function timed(client,kind,scope){
 let count=0;
 const watched={async query(...args){count++;return client.query(...args)}};
 const begin=performance.now();
 const result=kind==='old'?await oldRead(watched,scope):await newRead(watched,scope);
 return {result,ms:performance.now()-begin,count};
}
async function main(){
 guard();
 const pool=new Pool({host:'127.0.0.1',port:5432,database:DB,user:'postgres',
  password:'synthetic-only',max:3,statement_timeout:20000,
  application_name:'op37_paired_synthetic_perf'});
 try{
  const meta=(await pool.query("SELECT current_database() db,current_setting('server_version_num')::integer v")).rows[0];
  assert.equal(meta.db,DB);assert.equal(Math.floor(meta.v/10000),17);
  await seed(pool);
  const n=(await pool.query('SELECT count(*)::integer n FROM users')).rows[0].n;
  assert.equal(n,612);
  const results=[];
  for(const scope of SCOPES){
   const before=await timed(pool,'old',scope);
   const after=await timed(pool,'new',scope);
   assert.deepEqual(after.result,before.result);
   assert.equal(before.count,187);
   assert.equal(after.count,3);
   const samples={old:[],new:[]};
   for(let i=0;i<REPS;i++){
    const order=i%2===0?['old','new']:['new','old'];
    for(const kind of order){
     const result=await timed(pool,kind,scope);
     assert.deepEqual(result.result,before.result,'Payload drift '+scope.name);
     assert.equal(result.count,kind==='old'?187:3);
     samples[kind].push(result.ms);
    }
   }
   results.push({scope:scope.name,users:n,questions:93,
    oldQueries:187,newQueries:3,
    legacy:summary(samples.old),optimized:summary(samples.new),
    medianSpeedup:+(pct(samples.old,.5)/pct(samples.new,.5)).toFixed(2)});
  }
  console.log('SONDAGGI_TEXT_PAIRED_BENCH_PASS');
  console.log('SONDAGGI_TEXT_PAIRED_BENCH_RESULT_JSON='+JSON.stringify({
    postgres:17,synthetic:true,accounts:n,
    opinionSlots:94,publishedQuestions:93,
    repetitionsPerScopeAndMode:REPS,results,
    limitations:[
     'NOT staging: Supabase Demos-Staging public schema is empty.',
     'Client-side SQL time on one CI runner; no Render, network or browser latency.',
     'Warm synthetic sample is not real production distribution or scale.',
     'Do not infer 1M-user capacity, billing savings or production percentile SLA.'
    ],
    noProductionChanges:true
  }));
 }finally{await pool.end()}
}
main().catch(e=>{console.error('OP37 paired benchmark failed',e);process.exitCode=1});
