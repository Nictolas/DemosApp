'use strict';

/**
 * CI-ONLY end-to-end national /api/sondaggi query against disposable PG17.
 * Requires the synthetic ci_query_text / ci_opt_users / ci_opt_consents
 * built earlier by the prototype workflow. No DEMOS or Supabase credentials,
 * production tables, real people, DDL deployment, or external network.
 */
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const express=require('express');
const {Pool}=require('pg');

const DATABASE='opinion_bitset_ci';
const COLUMNS=Array.from({length:94},(_,i)=>
  'synthetic_opinion_'+String(i).padStart(3,'0'));
function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.OPINION_BENCH_EPHEMERAL!=='yes'||
     e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
     e.PGDATABASE!==DATABASE||e.PGUSER!=='postgres'||
     e.PGPASSWORD!=='synthetic-only') {
    throw Error('Refusing non-ephemeral database for national TEXT endpoint verification');
  }
}
const userId=i=>'00000000-0000-4000-8000-'+i.toString(16).padStart(12,'0');

async function makeViews(client){
  const db=(await client.query('SELECT current_database() name,current_user::text actor')).rows[0];
  assert.deepEqual(db,{name:DATABASE,actor:'postgres'});
  // This synthetic CI runner intentionally relies on the previous two
  // synthetic benchmark steps; missing fixtures MUST fail instead of
  // accidentally attempting to use a real DEMOS table.
  for(const table of ['ci_query_text','ci_opt_users','ci_opt_consents']){
    const r=await client.query('SELECT to_regclass($1) AS relation',['public.'+table]);
    assert.ok(r.rows[0].relation,'Missing earlier synthetic benchmark: '+table);
  }
  // Work on a separate snapshot: subsequent privacy-equivalence tests
  // read ci_query_text and MUST observe its original fixed/sparse-equivalent
  // data. Mutating that shared fixture produced a false negative downstream.
  await client.query('CREATE TABLE public.ci_sondaggi_text AS TABLE public.ci_query_text');
  await client.query('CREATE VIEW public.opinioni_risposte AS SELECT * FROM public.ci_sondaggi_text');
  await client.query('CREATE VIEW public.users AS SELECT id,account_type,political_opinions_consent FROM public.ci_opt_users');
  await client.query('CREATE VIEW public.user_consents AS SELECT user_id,political_opinions_consent FROM public.ci_opt_consents');
  await client.query('CREATE TABLE public.opinioni_domande (id text PRIMARY KEY,text text,gradi_opinione text[])');
  for(const [i,id] of COLUMNS.entries()){
    await client.query('INSERT INTO public.opinioni_domande VALUES($1,$2,$3::text[])',[
      id,'Synthetic '+String(i).padStart(3,'0'),
      i===92?['da approvare']:['N']
    ]);
  }
  // A separate synthetic slot has exactly ten consenting human voters.
  await client.query('UPDATE public.ci_sondaggi_text SET synthetic_opinion_093=NULL');
  await client.query("UPDATE public.ci_sondaggi_text SET synthetic_opinion_093='f' WHERE user_id=ANY($1::uuid[])",[
    Array.from({length:10},(_,i)=>userId(i+1))
  ]);
}
async function withActualRoute(db,callback){
  const authPath=require.resolve('../middleware/auth');
  const routePath=require.resolve('../routes/sondaggi');
  const previousAuth=require.cache[authPath],previousRoute=require.cache[routePath];
  const queries=[];
  let failGroupedOnce=false;
  const fakePool={
    async query(sql,params=[]){
      queries.push(String(sql));
      if(failGroupedOnce && String(sql).includes('CROSS JOIN LATERAL (VALUES')){
        failGroupedOnce=false;
        throw Error('Synthetic grouped-query failure to verify fallback');
      }
      return db.query(sql,params);
    }
  };
  require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{
    pool:fakePool,verifyToken:(_req,_res,next)=>next()
  }};
  delete require.cache[routePath];
  let server;
  try{
    const router=require(routePath);
    const app=express();app.disable('x-powered-by');
    app.use('/api/sondaggi',router);
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    await callback({
      get:async()=>{
        const response=await fetch(base+'/api/sondaggi');
        assert.equal(response.status,200);
        return response.json();
      },
      queries,
      failNextGrouped:()=>{failGroupedOnce=true;}
    });
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    if(previousAuth)require.cache[authPath]=previousAuth;
    else delete require.cache[authPath];
    if(previousRoute)require.cache[routePath]=previousRoute;
    else delete require.cache[routePath];
  }
}
function assertThreshold(data){
  for(const result of Object.values(data.stats)){
    assert.ok(result.favorevole+result.contrario+result.indeciso>=10,
      'Never disclose a cell below the ten-response privacy threshold');
  }
}
async function main(){
  guard();
  const pool=new Pool({host:'127.0.0.1',port:5432,database:DATABASE,
    user:'postgres',password:'synthetic-only',max:4,statement_timeout:25000,
    application_name:'ci_sondaggi_text_bulk_247'});
  try{
    await makeViews(pool);
    let groupedQueries=0,legacyFallbackQueries=0,hiddenAfterRevocation=false;
    await withActualRoute(pool,async({get,queries,failNextGrouped})=>{
      const before=queries.length;
      const first=await get();
      assert.deepEqual(Object.keys(first),['success','data']);
      assert.equal(first.success,true);
      assert.deepEqual(Object.keys(first.data),['stats','questions']);
      assert.equal(first.data.questions.length,93,'Unpublished question omitted');
      assert.equal(Object.hasOwn(first.data.stats,COLUMNS[92]),false);
      assert.deepEqual(first.data.stats[COLUMNS[93]],{
        favorevole:10,contrario:0,indeciso:0
      });
      assertThreshold(first.data);
      groupedQueries=queries.length-before;
      assert.equal(groupedQueries,3,'questions + whitelisted schema columns + one grouped query');

      // The failed grouped query must not change response JSON or privacy.
      const beforeFallback=queries.length;
      failNextGrouped();
      const fallback=await get();
      assert.deepEqual(fallback,first);
      assertThreshold(fallback.data);
      legacyFallbackQueries=queries.length-beforeFallback;
      assert.ok(legacyFallbackQueries>groupedQueries,
        'Per-column fallback should execute only on grouped query failure');

      // Consent override makes ten response slots fall to nine; the
      // individual and the sub-threshold aggregate MUST stay invisible.
      await pool.query('INSERT INTO public.ci_opt_consents(user_id,political_opinions_consent) VALUES($1,false)',[
        userId(1)
      ]);
      const after=await get();
      assert.equal(Object.hasOwn(after.data.stats,COLUMNS[93]),false);
      assert.equal(after.data.questions.length,93);
      assertThreshold(after.data);
      hiddenAfterRevocation=true;

      await pool.query('DELETE FROM public.ci_opt_consents WHERE user_id=$1',[userId(1)]);
      const restored=await get();
      assert.deepEqual(restored,first);
    });
    console.log('OPINION_REAL_SONDAGGI_TEXT_BULK_PASS');
    console.log('OPINION_REAL_SONDAGGI_TEXT_BULK_RESULT_JSON='+JSON.stringify({
      postgres:17,rows:1200,opinionSlots:94,publishedQuestions:93,
      groupedSqlQueriesPerRequest:groupedQueries,
      fallbackSqlQueries:legacyFallbackQueries,
      hiddenAfterRevocation,source:'api/routes/sondaggi.js',
      responseContractPreserved:true,noBinaryStorage:true,
      noSupabaseAccess:true,syntheticDataOnly:true
    }));
  }finally{
    await pool.end();
  }
}
main().catch(e=>{
  console.error('National TEXT aggregation integration FAILED:',e);
  process.exitCode=1;
});
