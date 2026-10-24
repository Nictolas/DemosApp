'use strict';

/**
 * DOC-065: real PostgreSQL 17 integration for catalogs above the 256-column
 * SQL cap. Creates its own disposable DB in GitHub Actions only.
 * No Supabase, no Render, no migration to actual DEMOS databases.
 */
const assert=require('node:assert/strict');
const {Client,Pool}=require('pg');
const {getNationalSurveyStats,getTerritorialSurveyStats}=
  require('../utils/sondaggiTextBulk');
const DB='sondaggi_large_ci';
const COLUMNS=300;
const ids=Array.from({length:COLUMNS},(_,i)=>'synthetic_q'+String(i).padStart(3,'0'));
const scopes=[
  {name:'national'},
  {name:'regione',scope:'regione',params:['TO']},
  {name:'provincia',scope:'provincia',params:['TO','PI']},
  {name:'comune',scope:'comune',params:['TO','PI','Pisa']}
];
function guard(){
 const e=process.env;
 if(e.GITHUB_ACTIONS!=='true'||e.SONDAGGI_TEXT_CI!=='isolated'||
    e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
    e.PGDATABASE!=='sondaggi_text_ci'||e.PGUSER!=='postgres'||
    e.PGPASSWORD!=='synthetic-only'){
   throw Error('Refusing large synthetic catalog outside disposable PostgreSQL CI');
 }
}
const conn=database=>({
 host:'127.0.0.1',port:5432,database,user:'postgres',
 password:'synthetic-only',connectionTimeoutMillis:3500,
 statement_timeout:16000,application_name:'doc065_large_opinion_ci'
});
async function createDb(){
 const admin=new Client(conn('postgres'));
 await admin.connect();
 try{
  const probe=(await admin.query(
    "SELECT current_database() db,current_setting('server_version_num')::int v")).rows[0];
  assert.equal(probe.db,'postgres');
  assert.equal(Math.floor(probe.v/10000),17);
  await admin.query('CREATE DATABASE '+DB);
 }finally{await admin.end();}
}
async function seed(db){
 const names=ids.map(x=>'"'+x+'" text').join(',');
 await db.query('CREATE TABLE users ('+
   'id uuid PRIMARY KEY,account_type text,political_opinions_consent boolean,'+
   'regione_residenza text,provincia_residenza text,comune_residenza text)');
 await db.query('CREATE TABLE user_consents ('+
   'user_id uuid PRIMARY KEY,political_opinions_consent boolean)');
 await db.query('CREATE TABLE opinioni_risposte ('+
   'user_id uuid PRIMARY KEY,'+names+')');
 const uid="('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid";
 await db.query('INSERT INTO users SELECT '+uid+','+
   "CASE WHEN g=11 THEN 'ORGANIZATION' ELSE 'PERSON' END,"+
   "true,'TO','PI','Pisa' FROM generate_series(1,24) g");
 const values=ids.map((_,i)=>
   'CASE WHEN g <= '+(i===129?9:10)+" THEN 'f' ELSE NULL END").join(',');
 await db.query('INSERT INTO opinioni_risposte(user_id,'+
   ids.map(x=>'"'+x+'"').join(',')+') SELECT '+uid+','+values+
   ' FROM generate_series(1,24) g');
 const count=(await db.query(
   'SELECT COUNT(*)::int n FROM users')).rows[0].n;
 assert.equal(count,24);
}
function spy(client){
 let queries=0,aggregates=0;
 return {
  get queries(){return queries;},
  get aggregates(){return aggregates;},
  async query(...args){
   queries++;
   if(String(args[0]).includes('CROSS JOIN LATERAL (VALUES'))aggregates++;
   return client.query(...args);
  }
 };
}
async function runAll(db,questions){
 const results=[];
 for(const s of scopes){
  const wrapped=spy(db);
  const stats=s.scope?
    await getTerritorialSurveyStats(wrapped,questions,
      {scope:s.scope,params:s.params}):
    await getNationalSurveyStats(wrapped,questions);
  assert.equal(wrapped.queries,3,'One whitelist and two grouped SQL for '+s.name);
  assert.equal(wrapped.aggregates,2);
  assert.equal(Object.keys(stats).length,COLUMNS-1);
  assert.ok(!Object.hasOwn(stats,'synthetic_q129'));
  assert.deepEqual(stats.synthetic_q000,
    {favorevole:10,contrario:0,indeciso:0});
  assert.deepEqual(stats.synthetic_q299,
    {favorevole:10,contrario:0,indeciso:0});
  results.push({scope:s.name,queries:wrapped.queries,
    aggregateBatches:wrapped.aggregates,published:Object.keys(stats).length});
 }
 return results;
}
async function main(){
 guard();await createDb();
 const pool=new Pool({...conn(DB),max:2});
 try{
  await seed(pool);
  const questions=ids.map(id=>({id,text:id}));
  const first=await runAll(pool,questions);
  // A real GDPR-consent change must suppress every 10-voter cell, not
  // just one local mock result, on every scope and both SQL batches.
  await pool.query("INSERT INTO user_consents(user_id,political_opinions_consent)"+
    " VALUES('00000000-0000-4000-8000-000000000001',false)");
  for(const s of scopes){
   const wrapped=spy(pool);
   const stats=s.scope?
     await getTerritorialSurveyStats(wrapped,questions,
       {scope:s.scope,params:s.params}):
     await getNationalSurveyStats(wrapped,questions);
   assert.deepEqual(stats,{});
   assert.equal(wrapped.queries,3);
  }
  console.log('SONDAGGI_LARGE_REAL_PG17_PASS');
  console.log('SONDAGGI_LARGE_REAL_PG17_RESULT_JSON='+JSON.stringify({
    synthetic:true,postgres:17,accounts:24,columns:COLUMNS,
    batchLimit:256,results:first,
    consentRevocationFrom10To9:true,
    allScopesHiddenAfterRevocation:true,
    noSupabase:true,noDeploy:true
  }));
 }finally{await pool.end();}
}
main().catch(e=>{
 console.error('DOC065 real large-catalog PG17 test failed:',e);
 process.exitCode=1;
});
