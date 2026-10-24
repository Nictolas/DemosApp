'use strict';

/**
 * OP-37 Demos-Staging-only Render HTTP probe. Runs the actual PR #258
 * GET /api/sondaggi router with a strict query adapter for the separate
 * synthetic op37_sondaggi_ci schema. Production routes are not deployed.
 *
 * The only public endpoints are /health and /benchmark/summary.
 * All opinion routes require an opaque staging-only token. No passwords,
 * keys, UUIDs, or individual answers are ever returned by the public API.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {performance} = require('node:perf_hooks');
const http = require('node:http');
const express = require('express');
const {Pool} = require('pg');

const STAGING_REF='fkeayjzvtuvzesljhjbc';
const EXPECTED_HOST='db.'+STAGING_REF+'.supabase.co';
const SCHEMA='op37_sondaggi_ci';
const READ_ROLE='op37_http_staging_reader';
const PATHS=['/api/sondaggi','/api/sondaggi/toscana',
 '/api/sondaggi/toscana/pisa','/api/sondaggi/toscana/pisa/pisa'];
const TRIALS=12;
const QUESTION='synthetic_opinion_093';
const SCOPE=['national','region','province','municipality'];

function guard() {
 const e=process.env;
 const valid=e.OP37_STAGING_HTTP_ONLY==='yes' &&
   e.RENDER==='true' && e.PGHOST===EXPECTED_HOST &&
   e.PGPORT==='5432' && e.PGDATABASE==='postgres' &&
   e.PGUSER===READ_ROLE && typeof e.PGPASSWORD==='string' &&
   e.PGPASSWORD.length>=48 && typeof e.OP37_HTTP_TOKEN==='string' &&
   e.OP37_HTTP_TOKEN.length>=48 &&
   !e.DATABASE_URL && !e.SUPABASE_SERVICE_ROLE_KEY &&
   !e.SUPABASE_DB_URL && !e.SUPABASE_URL;
 if(!valid) throw Error('OP37_STAGING_GUARD_FAILED: service must use only dedicated staging credentials');
}
function eqToken(a,b) {
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
function assertSafeRead(sql) {
 if(typeof sql!=='string'||!(/^\s*(SELECT|WITH)\b/i).test(sql)) {
   throw Error('OP37_READ_ONLY_QUERY_REQUIRED');
 }
 if(/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|COPY|CALL)\b/i.test(sql)) {
   throw Error('OP37_NON_SELECT_OPERATION');
 }
 if(/\b(?:auth|storage|public)\s*\./i.test(sql)) {
   throw Error('OP37_NON_STAGING_SCHEMA');
 }
}
function rewriteOnlySyntheticTables(sql) {
 assertSafeRead(sql);
 const substitutions=[
  [/\b(FROM|JOIN)\s+opinioni_domande\b/gi,'$1 '+SCHEMA+'.opinioni_domande'],
  [/\b(FROM|JOIN)\s+opinioni_risposte\b/gi,'$1 '+SCHEMA+'.opinioni_risposte'],
  [/\b(FROM|JOIN)\s+users\b/gi,'$1 '+SCHEMA+'.users'],
  [/\b(FROM|JOIN)\s+user_consents\b/gi,'$1 '+SCHEMA+'.user_consents'],
  [/table_schema\s*=\s*'public'/g,"table_schema = '"+SCHEMA+"'"],
 ];
 let result=sql;
 for(const [regex,replacement] of substitutions)result=result.replace(regex,replacement);
 // Fail closed if new production-only dependencies get introduced.
 if(/\b(FROM|JOIN)\s+(?!op37_sondaggi_ci\.|information_schema\.|pg_catalog\.|LATERAL\s*\()[a-z][a-z0-9_]*\b/i.test(result)){
  throw Error('OP37_NON_STAGING_TABLE_QUERY');
 }
 return result;
}
const pct=(a,p)=>{
 const s=[...a].sort((a,b)=>a-b);
 return +(s[Math.max(0,Math.ceil(s.length*p)-1)]).toFixed(2);
};
function stat(samples){
 return {n:samples.length,meanMs:+(samples.reduce((a,b)=>a+b,0)/samples.length).toFixed(2),
  p50Ms:pct(samples,.50),p95Ms:pct(samples,.95),minMs:pct(samples,0),
  maxMs:pct(samples,1)};
}

function startSetupOnly(){
 const e=process.env;
 if(e.OP37_STAGING_HTTP_ONLY!=='yes' || e.RENDER!=='true' ||
    e.OP37_STAGING_SETUP_ONLY!=='yes' ||
    e.PGPASSWORD || e.DATABASE_URL || e.SUPABASE_SERVICE_ROLE_KEY ||
    e.SUPABASE_DB_URL || e.SUPABASE_URL){
   throw Error('OP37_SETUP_ONLY_GUARD_FAILED');
 }
 // Deliberately refuses every database request until a dedicated
 // staging credential is installed out of band.
 const app=express();
 app.disable('x-powered-by');
 app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});
 app.get('/',(req,res)=>res.json({
   scope:'op37-synthetic-staging',mode:'setup_required',
   databaseConnected:false,productionConnected:false
 }));
 app.get('/health',(req,res)=>res.status(503).json({
   scope:'op37-synthetic-staging',ready:false,reason:'staging_credential_not_configured'
 }));
 app.get('/benchmark/summary',(req,res)=>res.status(503).json({ready:false}));
 app.use((req,res)=>res.status(404).json({error:'not_found'}));
 const port=Number(process.env.PORT)||10000;
 app.listen(port,'0.0.0.0',()=>console.log('OP37_RENDER_SETUP_ONLY_NO_DATABASE'));
}
async function main(){
 if(process.env.OP37_STAGING_SETUP_ONLY==='yes')return startSetupOnly();
 guard();
 const pool=new Pool({
  host:process.env.PGHOST,port:5432,database:'postgres',
  user:READ_ROLE,password:process.env.PGPASSWORD,
  ssl:{rejectUnauthorized:true},
  max:3,statement_timeout:11000,connectionTimeoutMillis:6500,
  idleTimeoutMillis:10000,application_name:'op37-render-staging-http'
 });
 let sqlQueries=0;
 let result=null;
 let running=false;
 const wrappedPool={
  async query(sql,params){
   const safe=rewriteOnlySyntheticTables(sql);
   sqlQueries++;
   return pool.query(safe,params);
  }
 };
 const authPath=require.resolve('../middleware/auth');
 const routePath=require.resolve('../routes/sondaggi');
 const savedAuth=require.cache[authPath],savedRoute=require.cache[routePath];
 require.cache[authPath]={id:authPath,filename:authPath,loaded:true,
  exports:{pool:wrappedPool,verifyToken:(req,res,next)=>next()}};
 delete require.cache[routePath];
 let router;
 try{router=require(routePath);}
 finally{
  if(savedAuth)require.cache[authPath]=savedAuth;
  else delete require.cache[authPath];
  if(savedRoute)require.cache[routePath]=savedRoute;
  else delete require.cache[routePath];
 }
 const app=express();
 app.disable('x-powered-by');
 app.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  next();
 });
 app.get('/health',(req,res)=>res.status(result?200:503).json({
   scope:'op37-synthetic-staging',ready:!!result,
   productionConnected:false,privateDataAvailable:false
 }));
 app.get('/benchmark/summary',(req,res)=>{
  if(!result)return res.status(503).json({ready:false});
  return res.json(result);
 });
 // Production-like aggregate GET routes are strictly protected, with an
 // exact path allowlist and no access to other opinion/user endpoints.
 app.use('/api/sondaggi',(req,res,next)=>{
  if(result)return res.status(503).json({error:'benchmark_finished'});
  if(req.method!=='GET'||!PATHS.includes(req.path==='/'
    ?'/api/sondaggi':'/api/sondaggi'+req.path)){
   return res.status(404).json({error:'not_found'});
  }
  if(!eqToken(req.get('x-op37-staging-token'),process.env.OP37_HTTP_TOKEN)){
   return res.status(404).json({error:'not_found'});
  }
  next();
 },router);
 app.use((req,res)=>res.status(404).json({error:'not_found'}));

 const port=Number(process.env.PORT)||10000;
 const server=http.createServer(app);
 await new Promise(resolve=>server.listen(port,'0.0.0.0',resolve));

 try{
  // These are the ONLY SQL reads outside the adapter and verify that
  // credentials can't point to Demos production.
  const q=await pool.query("SELECT current_database() AS db,current_user AS role,current_setting('server_version_num')::int AS ver");
  assert.equal(q.rows[0].db,'postgres');
  assert.equal(q.rows[0].role,READ_ROLE);
  assert.equal(Math.floor(q.rows[0].ver/10000),17);
  const fixture=await pool.query('SELECT '+
    '(SELECT count(*)::int FROM '+SCHEMA+'.users) AS people,'+
    '(SELECT count(*)::int FROM '+SCHEMA+'.opinioni_domande) AS questions,'+
    '(SELECT count(*)::int FROM '+SCHEMA+'.opinioni_risposte) AS votes');
  assert.deepEqual(fixture.rows[0],{people:1200,questions:94,votes:1200});
  // Check there is no accidental privilege on real public tables.
  const access=await pool.query("SELECT has_schema_privilege(current_user,'public','USAGE') AS public_access");
  // Supabase can grant schema USAGE to some roles; deny reads by role
  // grants plus adapter and the staging-only hostname above.
  const local='http://127.0.0.1:'+port;
  const samples=[],counts=[];
  const boundary=[];
  for(let i=0;i<TRIALS+1;i++){
   for(let j=0;j<PATHS.length;j++){
    const path=PATHS[j];
    const began=performance.now(),before=sqlQueries;
    const response=await fetch(local+path,{
     headers:{'x-op37-staging-token':process.env.OP37_HTTP_TOKEN},
     signal:AbortSignal.timeout(20000)
    });
    const body=await response.json();
    assert.equal(response.status,200,path);
    assert.equal(body.success,true,path);
    assert.equal(body.data.questions.length,93,path);
    assert.ok(body.data.stats[QUESTION],'Synthetic threshold-ten opinion missing '+path);
    assert.equal(body.data.stats[QUESTION].favorevole,10,path);
    const ms=performance.now()-began;
    const count=sqlQueries-before;
    assert.equal(count,3,'Expected exactly 3 SELECT queries for '+path);
    if(i>0){
     if(!samples[j])samples[j]=[];
     if(!counts[j])counts[j]=[];
     samples[j].push(ms);counts[j].push(count);
    }
    boundary.push(true);
   }
  }
  // A headerless endpoint must not leak statistics.
  const denied=await fetch(local+'/api/sondaggi');
  assert.equal(denied.status,404);
  result={
   status:'PASS',environment:'Demos-Staging',schema:SCHEMA,
   deployedPrBranch:'feature/sondaggi-text-bulk-op37-20261024',
   pgVersion:17,syntheticPeople:1200,publishedOpinions:93,
   sqlQueriesPerRequest:3,privacyBoundaryTen:true,
   sourceRoute:'api/routes/sondaggi.js',
   samplesPerScope:TRIALS,
   results:PATHS.map((path,i)=>({scope:SCOPE[i],path,...stat(samples[i])})),
   accessPolicy:'GET with staging-only token; public only health and benchmark summary',
   limitations:[
    'HTTP local-loopback on Render service plus live Supabase staging network, not external client RTT.',
    'Staging-only 1200 synthetic rows; cannot infer performance under real production traffic.',
    'No login/Android tests; privacy changes are validated separately in CI and SQL fixture.',
    'Dedicated database role is read-only on synthetic staging schema only.'
   ]
  };
  console.log('OP37_RENDER_STAGING_HTTP_PASS '+JSON.stringify({
   status:result.status,samples:TRIALS,queries:3,
   stats:result.results.map(r=>({scope:r.scope,p50:r.p50Ms,p95:r.p95Ms}))
  }));
 }catch(e){
  console.error('OP37_RENDER_STAGING_HTTP_FAILED',
   JSON.stringify({name:e.name,code:e.code||'',reason:String(e.message).slice(0,160)}));
  result=null;
  process.exitCode=1;
 }finally{
  await pool.end().catch(()=>{});
  // On failure the process exits; on success the HTTP listener only
  // serves static aggregate benchmark summaries and no live SQL.
  if(!result)server.close();
 }
}
// Export pure guards for isolated CI tests. Requiring this module may
// never open a listener or an external connection.
module.exports = Object.freeze({
  guard, eqToken, assertSafeRead, rewriteOnlySyntheticTables
});

if (require.main === module) {
  main().catch(e => {
    console.error('OP37_STARTUP_FAIL_CLOSED',String(e.message).slice(0,160));
    process.exitCode=1;
  });
}
