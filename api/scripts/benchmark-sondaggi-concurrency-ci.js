'use strict';

/**
 * DOC-072: bounded concurrency / connection-pool regression on disposable
 * GitHub Actions PostgreSQL 17 and real Express GET Sondaggi routes.
 * Synthetic accounts and votes ONLY. Never Supabase or Render.
 * Results are measurements of the CI runner, not a production capacity SLA.
 */
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const http=require('node:http');
const express=require('express');
const {Pool,Client}=require('pg');

const DB='sondaggi_concurrency_ci';
const ACCOUNTS=10000;
const POOL_MAX=3;
const COLUMNS=Array.from({length:94},(_,i)=>
  'synthetic_opinion_'+String(i).padStart(3,'0'));
const ROUTES=[
  '/api/sondaggi',
  '/api/sondaggi/toscana',
  '/api/sondaggi/toscana/pisa',
  '/api/sondaggi/toscana/pisa/pisa'
];
const SETTINGS=[{clients:1,requests:12},{clients:4,requests:12},
  {clients:8,requests:24},{clients:16,requests:32}];

function guard(){
 const e=process.env;
 if(e.GITHUB_ACTIONS!=='true'||e.SONDAGGI_TEXT_CI!=='isolated'||
    e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
    e.PGDATABASE!=='sondaggi_text_ci'||e.PGUSER!=='postgres'||
    e.PGPASSWORD!=='synthetic-only'||e.RENDER||e.DATABASE_URL||
    e.SUPABASE_URL||e.SUPABASE_DB_URL||e.SUPABASE_SERVICE_ROLE_KEY||
    e.OP37_HTTP_TOKEN||e.OP37_SUPABASE_CA_CERT)
   throw Error('DOC-072 refuses non-isolated synthetic PG17 CI environment');
}
const pg=database=>({
 host:'127.0.0.1',port:5432,database,user:'postgres',
 password:'synthetic-only',statement_timeout:12000,
 connectionTimeoutMillis:4500,application_name:'doc072_only_synthetic'
});
async function createDb(){
 const c=new Client(pg('postgres'));
 await c.connect();
 try{
  const d=(await c.query("SELECT current_database() db, current_setting('server_version_num')::int version")).rows[0];
  assert.equal(d.db,'postgres');
  assert.equal(Math.floor(d.version/10000),17);
  await c.query('CREATE DATABASE '+DB);
 }finally{await c.end();}
}
const uuid="('00000000-0000-4000-8004-'||lpad(g::text,12,'0'))::uuid";
async function seed(db){
 await db.query('CREATE TABLE users (id uuid PRIMARY KEY,account_type text NOT NULL,'+
   'political_opinions_consent boolean,regione_residenza text,'+
   'provincia_residenza text,comune_residenza text)');
 await db.query('CREATE TABLE user_consents (user_id uuid PRIMARY KEY REFERENCES users(id),'+
   'political_opinions_consent boolean)');
 await db.query('CREATE TABLE opinioni_domande (id text PRIMARY KEY,text text NOT NULL,gradi_opinione text[])');
 await db.query('CREATE TABLE opinioni_risposte (user_id uuid PRIMARY KEY REFERENCES users(id),'+
   COLUMNS.map(c=>'"'+c+'" text').join(',')+')');
 for(let i=0;i<COLUMNS.length;i++){
  await db.query('INSERT INTO opinioni_domande VALUES($1,$2,$3::text[])',[
    COLUMNS[i],'Synthetic survey '+String(i).padStart(3,'0'),
    i===92?['da approvare']:['N']
  ]);
 }
 const values=COLUMNS.map((_,i)=>
   i===93?"CASE WHEN g<=10 THEN 'f' ELSE NULL END":
   "CASE WHEN (g+"+i+"*7)%12=0 THEN "+
   "CASE (g+"+i+")%3 WHEN 0 THEN 'f' WHEN 1 THEN 'c' ELSE 'i' END ELSE NULL END");
 for(let start=1;start<=ACCOUNTS;start+=2000){
  const end=Math.min(start+1999,ACCOUNTS);
  await db.query('INSERT INTO users SELECT '+uuid+','+
   "CASE WHEN g%17=0 THEN 'ORGANIZATION' ELSE 'PERSON' END,"+
   "g%13<>0,CASE WHEN g<=10 OR g%3=0 THEN 'TO' ELSE 'LO' END,"+
   "CASE WHEN g<=10 OR g%3=0 THEN 'PI' ELSE 'MI' END,"+
   "CASE WHEN g<=10 OR g%3=0 THEN 'Pisa' ELSE 'Milano' END "+
   'FROM generate_series($1::int,$2::int) g',[start,end]);
  await db.query('INSERT INTO opinioni_risposte(user_id,'+
   COLUMNS.map(c=>'"'+c+'"').join(',')+') SELECT '+uuid+','+
   values.join(',')+' FROM generate_series($1::int,$2::int) g',[start,end]);
  await db.query('INSERT INTO user_consents SELECT '+uuid+
    ',false FROM generate_series($1::int,$2::int) g WHERE g%29=0',
    [start,end]);
 }
 for(const table of ['users','user_consents','opinioni_domande','opinioni_risposte'])
  await db.query('ANALYZE '+table);
 assert.equal((await db.query('SELECT count(*)::int n FROM users')).rows[0].n,ACCOUNTS);
 assert.equal((await db.query("SELECT count(*)::int n FROM opinioni_domande WHERE 'da approvare'<>ALL(gradi_opinione)")).rows[0].n,93);
}
function percentile(values,p){
 const sorted=[...values].sort((a,b)=>a-b);
 return +(sorted[Math.max(0,Math.ceil(values.length*p)-1)]).toFixed(2);
}
function stats(values){
 return {n:values.length,p50Ms:percentile(values,.5),
  p95Ms:percentile(values,.95),maxMs:percentile(values,1)};
}
async function openApp(pool,fn){
 const auth=require.resolve('../middleware/auth');
 const route=require.resolve('../routes/sondaggi');
 const catalogPath=require.resolve('../services/opinionCatalog.js');
 const prevAuth=require.cache[auth],prevRoute=require.cache[route],prevCatalog=require.cache[catalogPath];
 // Isolated 93-item synthetic published catalog; this benchmarks the real
 // route/aggregation SQL under load, not the database catalog lookup.
 const published=COLUMNS.map((id,i)=>({id,text:'Synthetic survey '+String(i).padStart(3,'0')}))
   .filter(({id})=>id!==COLUMNS[92]);
 require.cache[catalogPath]={id:catalogPath,filename:catalogPath,loaded:true,
  exports:{getAllOpinions:()=>published,sortOpinionsByText:xs=>xs}};
 let queryCount=0,activeQueries=0,maxActiveQueries=0,server;
 const monitored={
  async query(sql,params){
   const source=String(sql);
   assert.match(source,/^\s*(SELECT|WITH)\b/i,'Only SELECTs allowed in measured GET');
   queryCount++;activeQueries++;maxActiveQueries=Math.max(maxActiveQueries,activeQueries);
   try{return await pool.query(sql,params);}
   finally{activeQueries--;}
  }
 };
 require.cache[auth]={id:auth,filename:auth,loaded:true,
  exports:{pool:monitored,verifyToken:(_r,_s,next)=>next()}};
 delete require.cache[route];
 try{
  const router=require(route);
  const app=express();app.disable('x-powered-by');
  app.use('/api/sondaggi',router);
  server=http.createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  await fn({
   base,
   count:()=>queryCount,
   active:()=>activeQueries,
   maxActive:()=>maxActiveQueries
  });
 }finally{
  if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  if(prevAuth)require.cache[auth]=prevAuth;else delete require.cache[auth];
  if(prevRoute)require.cache[route]=prevRoute;else delete require.cache[route];
  if(prevCatalog)require.cache[catalogPath]=prevCatalog;else delete require.cache[catalogPath];
 }
}
async function get(base,route,timeout=14000){
 const began=performance.now();
 const response=await fetch(base+route,{
   headers:{'cache-control':'no-store'},
   signal:AbortSignal.timeout(timeout)
 });
 const payload=await response.json();
 assert.equal(response.status,200,route+' '+JSON.stringify(payload).slice(0,180));
 assert.equal(payload.success,true);
 assert.equal(payload.data.questions.length,93);
 assert.ok(!payload.data.questions.some(q=>q.id===COLUMNS[92]));
 for(const value of Object.values(payload.data.stats))
  assert.ok(value.favorevole+value.contrario+value.indeciso>=10);
 return {elapsed:performance.now()-began,payload};
}
async function batch(config,base,reference,pool,marker,metrics){
 let current=0,failures=0,peakRss=process.memoryUsage().rss;
 let peakWaiting=0,peakPoolTotal=0,peakPoolIdle=0;
 const poll=setInterval(()=>{
  peakRss=Math.max(peakRss,process.memoryUsage().rss);
  peakWaiting=Math.max(peakWaiting,pool.waitingCount);
  peakPoolTotal=Math.max(peakPoolTotal,pool.totalCount);
  peakPoolIdle=Math.max(peakPoolIdle,pool.idleCount);
 },5);
 const elapsed=[];
 const began=performance.now();
 const cpuBegin=process.cpuUsage();
 try{
  await Promise.all(Array.from({length:config.clients},async()=>{
   while(current<config.requests){
    const index=current++;
    const path=ROUTES[index%ROUTES.length];
    try{
     const result=await get(base,path);
     assert.deepEqual(result.payload,reference[path],
       'Concurrent JSON divergence from initial published data');
     elapsed.push(result.elapsed);
    }catch(e){
     failures++;
     throw e;
    }
   }
  }));
 }finally{clearInterval(poll);}
 const cpu=process.cpuUsage(cpuBegin);
 assert.equal(failures,0);
 assert.equal(elapsed.length,config.requests);
 assert.ok(pool.totalCount<=POOL_MAX);
 assert.ok(metrics.active()===0);
 return {
  clients:config.clients,requests:config.requests,
  errors:failures,wallMs:+(performance.now()-began).toFixed(2),
  ...stats(elapsed),
  maxPoolConnections:Math.max(peakPoolTotal,pool.totalCount),
  maxPoolWaiting:peakWaiting,maxPoolIdle:peakPoolIdle,
  peakNodeRssMiB:+(peakRss/1048576).toFixed(2),
  nodeCpuMs:+((cpu.user+cpu.system)/1000).toFixed(2),
  note:'Node CPU excludes PostgreSQL server CPU; same-host localhost only',
  mode:marker
 };
}
async function main(){
 guard();await createDb();
 const pool=new Pool({...pg(DB),max:POOL_MAX});
 try{
  await seed(pool);
  await openApp(pool,async metrics=>{
   const beforeFlag=process.env.SONDAGGI_EXPERIMENTAL_DIRECT_FILTER;
   if(beforeFlag!==undefined)throw Error('CI must start with direct FILTER flag unset');
   const result=[];
   try{
    for(const mode of ['lateral_default','direct_filter_opt_in']){
     if(mode==='direct_filter_opt_in')
      process.env.SONDAGGI_EXPERIMENTAL_DIRECT_FILTER='true';
     else delete process.env.SONDAGGI_EXPERIMENTAL_DIRECT_FILTER;
     const reference={};
     for(const route of ROUTES){
      const r=await get(metrics.base,route);
      reference[route]=r.payload;
      assert.deepEqual(r.payload.data.stats[COLUMNS[93]],
       {favorevole:10,contrario:0,indeciso:0},
       'Synthetic boundary-ten cell must publish before revocation');
     }
     const modes=[];
     for(const setting of SETTINGS){
      const queriesBefore=metrics.count();
      const sample=await batch(setting,metrics.base,reference,pool,mode,metrics);
      assert.equal(metrics.count()-queriesBefore,2*setting.requests,
       'Every GET must execute exactly 2 SELECTs: schema whitelist and grouped aggregation');
      sample.sqlQueries=2*setting.requests;
      modes.push(sample);
     }
     result.push({mode,loads:modes});
    }
    // Real consent revocation: despite prior successful, concurrent responses,
    // a new request must suppress the exactly-ten synthetic boundary cell.
    await pool.query("INSERT INTO user_consents(user_id,political_opinions_consent) "+
      "VALUES('00000000-0000-4000-8004-000000000001',false)");
    const after=[];
    for(const mode of ['lateral_default','direct_filter_opt_in']){
     if(mode==='direct_filter_opt_in')
      process.env.SONDAGGI_EXPERIMENTAL_DIRECT_FILTER='true';
     else delete process.env.SONDAGGI_EXPERIMENTAL_DIRECT_FILTER;
     const queriesBefore=metrics.count();
     const burst=await Promise.all(Array.from({length:16},(_,i)=>
      get(metrics.base,ROUTES[i%ROUTES.length])));
     for(const item of burst){
      assert.ok(!Object.hasOwn(item.payload.data.stats,COLUMNS[93]),
       'Post-revocation request must not reveal a nine-voter cell');
     }
     assert.equal(metrics.count()-queriesBefore,32);
     after.push({mode,requests:16,allFourScopes:true,
      consentRevocationTenToNineHidesAll:true});
    }
    const publishedBaseline=result.find(x=>x.mode==='lateral_default').loads.length;
    assert.equal(publishedBaseline,4);
    console.log('SONDAGGI_CONCURRENCY_PG17_PASS');
    console.log('SONDAGGI_CONCURRENCY_PG17_RESULT_JSON='+JSON.stringify({
     isolatedSynthetic:true,postgres:17,accounts:ACCOUNTS,
     answers:'sparse TEXT',poolMax:POOL_MAX,
     totalConcurrentRequestsPerMode:SETTINGS.reduce((a,v)=>a+v.requests,0),
     scenarios:result,postRevocation:after,
     warnings:['No Supabase, Render, Android or remote-client networking.',
      'Pool wait/Node RSS/Node CPU measured; PostgreSQL CPU is NOT measured.',
      'Short CI bursts and low samples are not robust p95/SLA evidence.',
      'No projection to 1,000,000 accounts or Free tier capacity.'],
     productionUntouched:true
    }));
   }finally{
    if(beforeFlag===undefined)delete process.env.SONDAGGI_EXPERIMENTAL_DIRECT_FILTER;
    else process.env.SONDAGGI_EXPERIMENTAL_DIRECT_FILTER=beforeFlag;
   }
  });
 }finally{await pool.end();}
}
main().catch(e=>{console.error('DOC072 isolated concurrency failure:',e);process.exitCode=1;});
