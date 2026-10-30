'use strict';

/**
 * OP-37 dedicated CI: real Express GET /api/sondaggi and actual PostgreSQL
 * 17 on one disposable GitHub Actions runner. Only fabricated vote records.
 *
 * Does not access DEMOS accounts, Render, or the Supabase project.
 */
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const {Pool} = require('pg');

const DB='sondaggi_text_ci';
const COLS=Array.from({length:94},(_,i)=>'synthetic_opinion_'+String(i).padStart(3,'0'));
const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.SONDAGGI_TEXT_CI!=='isolated'||
     e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
     e.PGDATABASE!==DB||e.PGUSER!=='postgres'||
     e.PGPASSWORD!=='synthetic-only'){
    throw Error('Refusing to use any database other than isolated PG17 CI');
  }
}
async function fixture(pool){
  const db=(await pool.query("SELECT current_database() AS db,current_user AS actor,current_setting('server_version_num')::int AS version")).rows[0];
  assert.equal(db.db,DB);assert.equal(db.actor,'postgres');
  assert.equal(Math.floor(db.version/10000),17);
  await pool.query('CREATE TABLE opinioni_domande(id text PRIMARY KEY,text text NOT NULL,gradi_opinione text[])');
  await pool.query('CREATE TABLE users ('+
    'id uuid PRIMARY KEY,account_type text NOT NULL,'+
    'political_opinions_consent boolean,regione_residenza text,'+
    'provincia_residenza text,comune_residenza text)');
  await pool.query('CREATE TABLE user_consents(user_id uuid PRIMARY KEY REFERENCES users(id),political_opinions_consent boolean)');
  await pool.query('CREATE TABLE opinioni_risposte ('+
    'user_id uuid PRIMARY KEY REFERENCES users(id),'+
    COLS.map(col=>'"'+col+'" text').join(',')+')');
  for(const [i,col] of COLS.entries()){
    await pool.query('INSERT INTO opinioni_domande VALUES($1,$2,$3::text[])',[
      col,'Synthetic question '+i,
      i===92?['da approvare']:['N']
    ]);
  }
  for(let i=1;i<=12;i++){
    await pool.query('INSERT INTO users VALUES($1,$2,$3,$4,$5,$6)',[
      uuid(i),i===11?'ORGANIZATION':'PERSON',
      i!==12,i<=10?'TO':'LO',i<=10?'PI':'MI',
      i<=10?'Pisa':'Milano'
    ]);
    const votes={};
    if(i<=10){
      votes[COLS[93]]='f';
      votes[COLS[0]]=i<=6?'f':i<=9?'c':'i';
      if(i<=9)votes[COLS[2]]='c';
    }else{
      votes[COLS[93]]='i';
      votes[COLS[0]]='i';
    }
    const columns=Object.keys(votes);
    const sql='INSERT INTO opinioni_risposte(user_id,'+
      columns.map(x=>'"'+x+'"').join(',')+') VALUES('+
      [uuid(i),...Object.values(votes)].map((_,j)=>'$'+(j+1)).join(',')+')';
    await pool.query(sql,[uuid(i),...Object.values(votes)]);
  }
  // Institution and nonconsenter never count toward minimum 10.
  const baseline=(await pool.query(
    'SELECT count(*)::int c FROM opinioni_risposte')).rows[0].c;
  assert.equal(baseline,12);
}
async function withApp(db,task){
  const authPath=require.resolve('../middleware/auth');
  const routePath=require.resolve('../routes/sondaggi');
  const catalogPath=require.resolve('../services/opinionCatalog.js');
  const oldAuth=require.cache[authPath],oldRoute=require.cache[routePath],oldCatalog=require.cache[catalogPath];
  // Dedicated synthetic fixture: 93 published + 1 draft (excluded). Real
  // production requests use the immutable 94-item released code catalog.
  const publicQuestions=COLS.map((id,i)=>({id,text:'Synthetic question '+i}))
    .filter(({id})=>id!==COLS[92]);
  require.cache[catalogPath]={id:catalogPath,filename:catalogPath,loaded:true,
    exports:{getAllOpinions:()=>publicQuestions,sortOpinionsByText:xs=>xs}};
  const queries=[];
  let failNext=false,server;
  const spy={
    async query(sql,params=[]){
      queries.push(String(sql));
      if(failNext&&String(sql).includes('CROSS JOIN LATERAL (VALUES')){
        failNext=false;
        throw Object.assign(Error('Simulated grouped feature unsupported'),{code:'0A000'});
      }
      return db.query(sql,params);
    }
  };
  require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{
    pool:spy,verifyToken:(_req,_res,next)=>next()
  }};
  delete require.cache[routePath];
  try{
    const router=require(routePath);
    const app=express();app.disable('x-powered-by');
    app.use('/api/sondaggi',router);
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    await task({
      get:async path=>{
        const response=await fetch(base+'/api/sondaggi'+path);
        assert.equal(response.status,200,path);
        return response.json();
      },
      queries,
      failNextGrouped(){failNext=true;}
    });
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    if(oldAuth)require.cache[authPath]=oldAuth;
    else delete require.cache[authPath];
    if(oldRoute)require.cache[routePath]=oldRoute;
    else delete require.cache[routePath];
    if(oldCatalog)require.cache[catalogPath]=oldCatalog;
    else delete require.cache[catalogPath];
  }
}
function assertPrivate(response){
  assert.equal(response.success,true);
  assert.equal(response.data.questions.length,93);
  assert.ok(!response.data.questions.some(q=>q.id===COLS[92]));
  assert.ok(!Object.hasOwn(response.data.stats,COLS[2]));
  for(const row of Object.values(response.data.stats)){
    assert.ok(row.favorevole+row.contrario+row.indeciso>=10);
  }
}
async function main(){
  guard();
  const pool=new Pool({host:'127.0.0.1',port:5432,database:DB,user:'postgres',
    password:'synthetic-only',max:5,statement_timeout:22000,
    application_name:'ci_op37_real_endpoint'});
  try{
    await fixture(pool);
    await withApp(pool,async({get,queries,failNextGrouped})=>{
      const routes=[
        ['',null],
        ['/toscana',{type:'regione',value:'Toscana'}],
        ['/toscana/pisa',{type:'provincia',value:'Pisa',regione:'Toscana',provincia:'Pisa'}],
        ['/toscana/pisa/pisa',{type:'comune',value:'Pisa',regione:'Toscana',provincia:'Pisa',comune:'Pisa'}]
      ];
      const expected={favorevole:6,contrario:3,indeciso:1};
      for(const [url,filter] of routes){
        const before=queries.length,body=await get(url);
        assertPrivate(body);
        assert.deepEqual(body.data.stats[COLS[0]],expected);
        assert.deepEqual(body.data.stats[COLS[93]],{
          favorevole:10,contrario:0,indeciso:0
        });
        if(filter)assert.deepEqual(body.data.filter,filter);
        else assert.equal(Object.hasOwn(body.data,'filter'),false);
        assert.equal(queries.length-before,2,
          'Code catalog: schema metadata + one grouped SQL, irrespective of question count');
        assert.equal(queries.slice(before).filter(q=>
          q.includes('CROSS JOIN LATERAL (VALUES')).length,1);
      }
      const far=await get('/toscana/firenze');
      assertPrivate(far);
      assert.deepEqual(far.data.stats,{});
      // For both national and municipal paths, failures use the old
      // per-column strategy and must never reveal under-10 results.
      for(const url of ['','/toscana/pisa/pisa']){
        const original=await get(url);
        const before=queries.length;
        failNextGrouped();
        const fallback=await get(url);
        assert.deepEqual(fallback,original);
        assert.ok(queries.length-before>3,'Fallback should take multiple queries');
      }
      // Actual consent override turns 10 into 9. Must disappear globally
      // and in all geographic scopes immediately (no public cache).
      await pool.query('INSERT INTO user_consents VALUES($1,false)',[uuid(1)]);
      for(const [url] of routes){
        const body=await get(url);
        assert.ok(!Object.hasOwn(body.data.stats,COLS[93]));
        assert.ok(!Object.hasOwn(body.data.stats,COLS[0]));
        assertPrivate(body);
      }
      await pool.query('DELETE FROM user_consents WHERE user_id=$1',[uuid(1)]);
      for(const [url] of routes){
        const restored=await get(url);
        assert.deepEqual(restored.data.stats[COLS[93]],{
          favorevole:10,contrario:0,indeciso:0
        });
      }
    });
    console.log('SONDAGGI_TEXT_BULK_REAL_PG17_PASS');
    console.log('SONDAGGI_TEXT_BULK_RESULT_JSON='+JSON.stringify({
      pg:17,synthetic:true,questions:94,published:93,
      sqlQueriesPerNormalRequest:2,scopes:4,
      consentRevocation10To9:true,queryFailureFallback:true,
      includesPersonConsentAndGeography:true,
      noSupabase:true,noDDLProduction:true,noDeploy:true
    }));
  }finally{await pool.end();}
}
main().catch(e=>{
  console.error('Isolated real Sondaggi SQL regression failed:',e);
  process.exitCode=1;
});
