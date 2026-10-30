'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const catalogPath = require.resolve('../services/opinionCatalog.js');

const {
  safeOpinionIds, buildNationalTextAggregateQuery, getNationalSurveyStats,
  buildTerritorialTextAggregateQuery, getTerritorialSurveyStats
} = require('../utils/sondaggiTextBulk');

const QUESTIONS = [
  { id: 'caccia', text: 'Caccia' },
  { id: 'nato', text: 'NATO' },
  { id: 'sotto_soglia', text: 'Piccola cella' },
  { id: 'nessuna_colonna', text: 'Domanda senza colonna' },
  { id: 'x";DROP TABLE users;--', text: 'Identificatore non valido' }
];

function fakePool({ failGrouped = false, failMetadata = false } = {}) {
  const calls = [];
  let metadataFailed = false;
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('FROM opinioni_domande')) {
        return { rows: QUESTIONS };
      }
      if (sql.includes('information_schema.columns')) {
        if (failMetadata && !metadataFailed) {
          metadataFailed = true;
          throw Object.assign(new Error('unsupported metadata query'),{code:'0A000'});
        }
        return { rows: (params[0] || [])
          .filter(id => ['caccia', 'nato', 'sotto_soglia'].includes(id))
          .map(column_name => ({ column_name })) };
      }
      if (sql.includes('CROSS JOIN LATERAL (VALUES')) {
        if (failGrouped) throw Object.assign(new Error('unsupported grouped query'),{code:'0A000'});
        return { rows: [
          { opinion_id: 'caccia', favorevole: '6', contrario: '3', indeciso: '1' },
          { opinion_id: 'nato', favorevole: '2', contrario: '4', indeciso: '4' },
          { opinion_id: 'sotto_soglia', favorevole: '9', contrario: '0', indeciso: '0' },
          { opinion_id: 'not_requested', favorevole: '100', contrario: '0', indeciso: '0' }
        ] };
      }
      if (sql.includes('FROM opinioni_risposte orr')) {
        const matched = /orr\."(caccia|nato|sotto_soglia)" IS NOT NULL/.exec(sql);
        if (!matched) throw Error('Unrecognized fallback query');
        return { rows: matched[1] === 'caccia'
          ? [{ favorevole: '6', contrario: '3', indeciso: '1' }]
          : matched[1] === 'nato'
            ? [{ favorevole: '2', contrario: '4', indeciso: '4' }]
            : [{ favorevole: '9', contrario: '0', indeciso: '0' }] };
      }
      throw Error('Unexpected SQL: '+sql);
    }
  };
  return {pool,calls};
}

const EXPECTED = {
  caccia: { favorevole: 6, contrario: 3, indeciso: 1 },
  nato: { favorevole: 2, contrario: 4, indeciso: 4 }
};

test('SQL catalog validation prevents injected identifiers and excludes unapproved/unmapped columns', () => {
  assert.deepEqual(safeOpinionIds(QUESTIONS),
    ['caccia','nato','sotto_soglia','nessuna_colonna']);
  for(const input of [
    [],['caccia','caccia'],['x";DROP TABLE users;--'],['X'],[null],
    ['a'.repeat(64)],Array.from({length:257},(_,i)=>'q'+i)
  ]) {
    assert.throws(()=>buildNationalTextAggregateQuery(input));
  }
  const sql=buildNationalTextAggregateQuery(['caccia','nato']);
  assert.match(sql,/CROSS JOIN LATERAL \(VALUES/);
  assert.match(sql,/orr\."caccia"/);
  assert.match(sql,/orr\."nato"/);
  assert.match(sql,/AND u\.account_type = 'PERSON'/);
  assert.match(sql,/COALESCE\(uc\.political_opinions_consent/);
  assert.match(sql,/v\.answer IS NOT NULL/);
  assert.doesNotMatch(sql,/DROP TABLE/);
});

test('national aggregation publishes only cells with 10+ explicit votes in two SQL calls', async()=>{
  const {pool,calls}=fakePool();
  const stats=await getNationalSurveyStats(pool,QUESTIONS);
  assert.deepEqual(stats,EXPECTED);
  assert.equal(calls.length,2);
  assert.match(calls[0].sql,/table_schema = 'public'/);
  assert.deepEqual(calls[0].params[0],
    ['caccia','nato','sotto_soglia','nessuna_colonna']);
  assert.match(calls[1].sql,/GROUP BY v\.opinion_id/);
  assert.doesNotMatch(calls[1].sql,/nessuna_colonna/);
  assert.doesNotMatch(calls[1].sql,/not_requested/);
});

test('unsupported grouped SQL falls back to per-opinion TEXT without exposing small cells',async()=>{
  const {pool,calls}=fakePool({failGrouped:true});
  const warnings=[];
  const stats=await getNationalSurveyStats(pool,QUESTIONS,{
    warn: (...args)=>warnings.push(args)
  });
  assert.deepEqual(stats,EXPECTED);
  assert.equal(warnings.length,1);
  assert.equal(calls.filter(c=>c.sql.includes('CROSS JOIN LATERAL')).length,1);
  assert.equal(calls.filter(c=>c.sql.includes('FROM opinioni_risposte orr')
    && !c.sql.includes('CROSS JOIN LATERAL')).length,3);
  for(const {sql} of calls)assert.doesNotMatch(sql,/DROP TABLE/);
});

test('metadata failure also uses the verified per-column fallback',async()=>{
  const {pool}=fakePool({failMetadata:true});
  const warnings=[];
  assert.deepEqual(await getNationalSurveyStats(pool,QUESTIONS,{
    warn:(...args)=>warnings.push(args)
  }),EXPECTED);
  assert.equal(warnings.length,1);
});

test('empty, unsafe-only, or unpublished list skips opinion SQL',async()=>{
  const {pool,calls}=fakePool();
  assert.deepEqual(await getNationalSurveyStats(pool,[]),{});
  assert.deepEqual(await getNationalSurveyStats(pool,[{
    id:'bad"; DROP TABLE users; --'
  }]),{});
  assert.equal(calls.length,0);
});

async function withRealSurveyRoute(pool,callback){
  const authFile=require.resolve('../middleware/auth');
  const routeFile=require.resolve('../routes/sondaggi');
  const oldAuth=require.cache[authFile];
  const oldCatalog=require.cache[catalogPath];
  // This route-level test uses five synthetic questions (including an unsafe
  // ID) so the response/SQL-identifier contract can be tested independently
  // from the real 94-entry snapshot. Production always uses the real module.
  require.cache[catalogPath]={id:catalogPath,filename:catalogPath,loaded:true,
    exports:{getAllOpinions:()=>QUESTIONS,sortOpinionsByText:xs=>xs}};
  const oldRoute=require.cache[routeFile];
  require.cache[authFile]={
    id:authFile,filename:authFile,loaded:true,
    exports:{
      pool,
      verifyToken:(_req,_res,next)=>next()
    }
  };
  delete require.cache[routeFile];
  let server;
  try {
    const router=require(routeFile);
    const app=express();
    app.use('/api/sondaggi',router);
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    await callback('http://127.0.0.1:'+server.address().port);
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    if(oldAuth)require.cache[authFile]=oldAuth;
    else delete require.cache[authFile];
    if(oldRoute)require.cache[routeFile]=oldRoute;
    else delete require.cache[routeFile];
    if(oldCatalog)require.cache[catalogPath]=oldCatalog;
    else delete require.cache[catalogPath];
  }
}

test('actual GET /api/sondaggi keeps legacy payload with one stats query',async()=>{
  const {pool,calls}=fakePool();
  await withRealSurveyRoute(pool,async base=>{
    const response=await fetch(base+'/api/sondaggi');
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{
      success:true,
      data:{
        stats:EXPECTED,
        questions:QUESTIONS.map(({id,text})=>({id,text}))
      }
    });
  });
  assert.equal(calls.length,2,'code catalog + schema whitelist + one stats query');
  assert.equal(calls.filter(c=>c.sql.includes('FROM opinioni_domande')).length,0);
  assert.equal(calls.filter(c=>c.sql.includes('CROSS JOIN LATERAL')).length,1);
});


const GEO_SCOPES = [
  {scope:'regione',params:['TO'],url:'/toscana',
    filter:{type:'regione',value:'Toscana'}},
  {scope:'provincia',params:['TO','PI'],url:'/toscana/pisa',
    filter:{type:'provincia',value:'Pisa',regione:'Toscana',provincia:'Pisa'}},
  {scope:'comune',params:['TO','PI','Pisa'],url:'/toscana/pisa/pisa',
    filter:{type:'comune',value:'Pisa',regione:'Toscana',provincia:'Pisa',comune:'Pisa'}}
];

test('territorial SQL allows only known scopes and parameterized geography',()=>{
  const expected=[
    'AND u.regione_residenza = $1',
    'AND u.provincia_residenza = $2',
    'AND u.comune_residenza = $3'
  ];
  for (const [index,scope] of GEO_SCOPES.entries()) {
    const sql=buildTerritorialTextAggregateQuery(['caccia','nato'],scope);
    assert.match(sql,/CROSS JOIN LATERAL \(VALUES/);
    assert.match(sql,/v.answer IS NOT NULL/);
    assert.match(sql,/u.account_type = 'PERSON'/);
    assert.match(sql,/COALESCE\(uc.political_opinions_consent/);
    assert.match(sql,/orr."caccia"/);
    assert.match(sql,/orr."nato"/);
    for(let k=0;k<expected.length;k++) {
      assert.equal(sql.includes(expected[k]),k<=index,
        'Incorrect geographic depth '+scope.scope+' '+expected[k]);
    }
    assert.doesNotMatch(sql,/Pisa|Toscana|DROP TABLE/);
  }
  for(const invalid of [
    {scope:'unknown',params:['TO']},
    {scope:'regione',params:[]},
    {scope:'regione',params:['TO','PI']},
    {scope:'provincia',params:['TO']},
    {scope:'comune',params:['TO','PI',null]},
    {scope:'comune',params:['TO','PI','']},
    {scope:'regione',params:'TO'}
  ]) {
    assert.throws(()=>buildTerritorialTextAggregateQuery(['caccia'],invalid));
  }
  for(const invalid of [['caccia','caccia'],['unsafe"; DROP TABLE users;--'],
    ['A'],[],Array.from({length:257},(_,i)=>'q'+i)]) {
    assert.throws(()=>buildTerritorialTextAggregateQuery(invalid,GEO_SCOPES[0]));
  }
});

test('territorial grouped SQL uses one consent-filtered query at every geographic depth',async()=>{
  for (const scope of GEO_SCOPES) {
    const {pool,calls}=fakePool();
    assert.deepEqual(await getTerritorialSurveyStats(pool,QUESTIONS,scope),EXPECTED);
    assert.equal(calls.length,2);
    assert.deepEqual(calls[0].params[0],[
      'caccia','nato','sotto_soglia','nessuna_colonna'
    ]);
    assert.deepEqual(calls[1].params,scope.params);
    assert.match(calls[1].sql,/GROUP BY v.opinion_id/);
    assert.doesNotMatch(calls[1].sql,/nessuna_colonna/);
  }
});

test('territorial SQL failures preserve legacy threshold and parameter binding in fallback',async()=>{
  for (const scope of GEO_SCOPES) {
    const {pool,calls}=fakePool({failGrouped:true});
    const warnings=[];
    assert.deepEqual(await getTerritorialSurveyStats(pool,QUESTIONS,scope,{
      warn:(...args)=>warnings.push(args)
    }),EXPECTED);
    assert.equal(warnings.length,1);
    const fallback=calls.filter(x=>x.sql.includes('FROM opinioni_risposte orr') &&
      !x.sql.includes('CROSS JOIN LATERAL'));
    assert.equal(fallback.length,3);
    for(const {sql,params} of fallback){
      assert.deepEqual(params,scope.params);
      assert.match(sql,/u.account_type = 'PERSON'/);
      assert.match(sql,/COALESCE\(uc.political_opinions_consent/);
      assert.doesNotMatch(sql,/DROP TABLE/);
    }
  }
});

test('actual regional, provincial and municipal GET keep exactly the legacy JSON filter contracts',async()=>{
  for(const scope of GEO_SCOPES){
    const {pool,calls}=fakePool();
    await withRealSurveyRoute(pool,async base=>{
      const response=await fetch(base+'/api/sondaggi'+scope.url);
      assert.equal(response.status,200);
      assert.deepEqual(await response.json(),{
        success:true,data:{
          stats:EXPECTED,
          questions:QUESTIONS.map(({id,text})=>({id,text})),
          filter:scope.filter
        }
      });
    });
    assert.equal(calls.length,2);
    assert.deepEqual(calls.at(-1).params,scope.params);
    assert.match(calls.at(-1).sql,/CROSS JOIN LATERAL \(VALUES/);
  }
});

test('territorial invalid region/province stay HTTP 400 without querying the DB',async()=>{
  const {pool,calls}=fakePool();
  await withRealSurveyRoute(pool,async base=>{
    for(const url of ['/not-an-italian-region',
      '/toscana/not-a-province',
      '/not-an-italian-region/pisa/pisa']){
      const response=await fetch(base+'/api/sondaggi'+url);
      assert.equal(response.status,400,url);
      assert.equal((await response.json()).success,false);
    }
  });
  assert.equal(calls.length,0);
});


test('temporary connection errors and overload do not trigger per-opinion fallback fanout',async()=>{
  for(const code of ['53300','57014','08006','57P01','42501','ECONNRESET','XX000']){
    for(const territorial of [false,true]){
      const {pool}=fakePool();
      const originalQuery=pool.query.bind(pool);
      let attempts=0;
      pool.query=async(sql,params)=>{
        attempts++;
        if(sql.includes('CROSS JOIN LATERAL (VALUES')){
          const e=Error('synthetic outage '+code);
          e.code=code;
          throw e;
        }
        return originalQuery(sql,params);
      };
      const scope=GEO_SCOPES[2];
      await assert.rejects(
        territorial
          ? getTerritorialSurveyStats(pool,QUESTIONS,scope)
          : getNationalSurveyStats(pool,QUESTIONS),
        err=>err.code===code,
        'Must propagate '+code+' without repeated SQL'
      );
      assert.equal(attempts,2,'Expected metadata and grouped read only for '+code);
    }
  }
});

test('fallback eligibility is limited to recognized static SQL incompatibilities',()=>{
  const {eligibleForLegacyFallback}=require('../utils/sondaggiTextBulk');
  for(const code of ['0A000','42601','42883','42703']){
    assert.equal(eligibleForLegacyFallback({code}),true);
  }
  for(const code of ['57014','53300','08006','42501','XX000','ECONNRESET',null]){
    assert.equal(eligibleForLegacyFallback({code}),false);
  }
  assert.equal(eligibleForLegacyFallback(new Error('no SQLSTATE')),false);
});


test('a transient error mid-fallback stops immediately in every scope, without partial publication',async()=>{
  const scenarios=[{name:'national',scope:null},...GEO_SCOPES.map(scope=>({name:scope.scope,scope}))];
  for(const {name,scope} of scenarios){
    for(const faultStep of ['metadata','aggregate']){
      for(const code of ['53300','57014','08006','42501','ECONNRESET']){
        const {pool,calls}=fakePool({failGrouped:true});
        const oldQuery=pool.query.bind(pool);
        let fallbackAggregates=0,fallbackMetadata=0;
        pool.query=async(sql,params)=>{
          const isLegacy=sql.includes('FROM opinioni_risposte orr') &&
            !sql.includes('CROSS JOIN LATERAL');
          const isMeta=sql.includes('information_schema.columns');
          if(isLegacy){
            fallbackAggregates++;
            if(faultStep==='aggregate' && fallbackAggregates===2)
              throw Object.assign(Error('Synthetic fault mid-fallback'),{code});
          }else if(isMeta){
            fallbackMetadata++;
            if(faultStep==='metadata' && fallbackMetadata===3)
              throw Object.assign(Error('Synthetic metadata fault mid-fallback'),{code});
          }
          return oldQuery(sql,params);
        };
        await assert.rejects(
          name==='national'
            ? getNationalSurveyStats(pool,QUESTIONS)
            : getTerritorialSurveyStats(pool,QUESTIONS,scope),
          e=>e.code===code,
          name+'/'+faultStep+'/'+code+': no partial response on DB failure'
        );
        assert.equal(fallbackAggregates,
          faultStep==='aggregate'?2:1,name+'/'+faultStep+'/'+code+' no further aggregate SQL');
        assert.equal(fallbackMetadata,3,name+'/'+faultStep+'/'+code+' no further metadata SQL');
        assert.equal(calls.filter(x=>x.sql.includes('CROSS JOIN LATERAL')).length,1);
      }
    }
  }
});

test('a removed column during fallback can be skipped without exposing under-ten cells',async()=>{
 for(const scope of [null,...GEO_SCOPES]){
  const {pool}=fakePool({failGrouped:true});
  const original=pool.query.bind(pool);
  let legacyCount=0;
  pool.query=async(sql,params)=>{
    if(sql.includes('FROM opinioni_risposte orr') &&
       !sql.includes('CROSS JOIN LATERAL')){
      legacyCount++;
      if(legacyCount===2)
        throw Object.assign(Error('Synthetic column dropped'),{code:'42703'});
    }
    return original(sql,params);
  };
  const stats=scope
    ?await getTerritorialSurveyStats(pool,QUESTIONS,scope)
    :await getNationalSurveyStats(pool,QUESTIONS);
  assert.deepEqual(stats,{caccia:EXPECTED.caccia});
  assert.equal(legacyCount,3);
  assert.ok(!Object.hasOwn(stats,'sotto_soglia'));
 }
});

test('HTTP surveys return 500, never successful partial stats, when fallback fails mid-request',async()=>{
 for(const url of ['/api/sondaggi','/api/sondaggi/toscana',
   '/api/sondaggi/toscana/pisa','/api/sondaggi/toscana/pisa/pisa']){
  const {pool,calls}=fakePool({failGrouped:true});
  const orig=pool.query.bind(pool);
  let fallback=0;
  pool.query=async(sql,params)=>{
    if(sql.includes('FROM opinioni_risposte orr') &&
       !sql.includes('CROSS JOIN LATERAL')){
      fallback++;
      if(fallback===2)
        throw Object.assign(Error('Synthetic transport lost'),{code:'08006'});
    }
    return orig(sql,params);
  };
  await withRealSurveyRoute(pool,async base=>{
    const res=await fetch(base+url);
    assert.equal(res.status,500,url);
    const body=await res.json();
    assert.equal(body.success,false,url);
    assert.equal(Object.hasOwn(body,'data'),false,url);
  });
  assert.equal(fallback,2,'Must not run third opinion after a transport outage');
  assert.equal(calls.filter(c=>c.sql.includes('CROSS JOIN LATERAL')).length,1);
 }
});


test('catalogs larger than 256 use bounded TEXT batches, not hundreds of fallback queries',async()=>{
 const questions=Array.from({length:600},(_,i)=>({id:'op'+String(i).padStart(4,'0')}));
 for(const scope of [null,...GEO_SCOPES]){
  const calls=[];
  const pool={async query(sql,params=[]){
   calls.push({sql,params});
   if(sql.startsWith('BEGIN') || sql==='COMMIT' || sql==='ROLLBACK')return {rows:[]};
   if(sql.includes('information_schema.columns')){
    return {rows:params[0].map(column_name=>({column_name}))};
   }
   if(sql.includes('CROSS JOIN LATERAL (VALUES')){
    const ids=[...sql.matchAll(/orr\."(op\d{4})"/g)].map(m=>m[1]);
    assert.ok(ids.length>=1&&ids.length<=256);
    const unique=new Set(ids);
    assert.equal(ids.length,unique.size);
    return {rows:ids.map(id=>({opinion_id:id,
      favorevole:id==='op0257'?'9':'10',contrario:0,indeciso:0}))};
   }
   throw Error('Unexpected fallback or SQL: '+sql.slice(0,140));
  }};
   pool.connect=async()=>({query:pool.query.bind(pool),release(){}});

  const stats=scope
    ?await getTerritorialSurveyStats(pool,questions,scope)
    :await getNationalSurveyStats(pool,questions);
  assert.equal(Object.keys(stats).length,599);
  assert.ok(!Object.hasOwn(stats,'op0257'));
  assert.deepEqual(stats.op0000,{favorevole:10,contrario:0,indeciso:0});
  assert.deepEqual(stats.op0599,{favorevole:10,contrario:0,indeciso:0});
  assert.equal(calls.length,6,'BEGIN + metadata + three grouped SELECTs + COMMIT');
  assert.equal(calls[0].sql,'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(calls.at(-1).sql,'COMMIT');
  assert.equal(calls.filter(c=>c.sql.includes('CROSS JOIN LATERAL')).length,3);
  const lengths=calls.filter(c=>c.sql.includes('CROSS JOIN LATERAL')).map(c=>
    [...c.sql.matchAll(/orr\."(op\d{4})"/g)].length);
  assert.deepEqual(lengths,[256,256,88]);
  if(scope){
   assert.deepEqual(calls.filter(c=>c.sql.includes('CROSS JOIN LATERAL')).map(c=>c.params),
    [scope.params,scope.params,scope.params]);
  }
 }
});

test('mid-batch DB outages discard all earlier batch results and stop subsequent batches',async()=>{
 const questions=Array.from({length:600},(_,i)=>({id:'op'+String(i).padStart(4,'0')}));
 for(const scope of [null,...GEO_SCOPES]){
  for(const code of ['57014','08006','53300']){
   let aggregates=0,queries=0;
   const pool={async query(sql,params=[]){
    queries++;
    if(sql.startsWith('BEGIN') || sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('information_schema.columns')){
     return {rows:params[0].map(column_name=>({column_name}))};
    }
    if(sql.includes('CROSS JOIN LATERAL (VALUES')){
     aggregates++;
     if(aggregates===2)throw Object.assign(Error('mid batch outage'),{code});
     return {rows:[{opinion_id:'op0000',favorevole:10,contrario:0,indeciso:0}]};
    }
    throw Error('Legacy fallback must not run after multi-batch outage');
   }};
   pool.connect=async()=>({query:pool.query.bind(pool),release(){}});

   await assert.rejects(
     scope?getTerritorialSurveyStats(pool,questions,scope)
       :getNationalSurveyStats(pool,questions),
     e=>e.code===code
   );
   assert.equal(queries,5,'BEGIN + whitelist + two failed aggregates + ROLLBACK');
   assert.equal(aggregates,2);
  }
 }
});

test('large catalog refuses legacy query amplification if grouped SQL unsupported',async()=>{
 for(const n of [129,257,600]){
  const questions=Array.from({length:n},(_,i)=>({id:'op'+i}));
  for(const scope of [null,...GEO_SCOPES]){
   let queries=0,aggregates=0;
   const pool={async query(sql,params=[]){
    queries++;
    if(sql.startsWith('BEGIN') || sql==='ROLLBACK')return {rows:[]};
    if(sql.includes('information_schema.columns'))
      return {rows:params[0].map(column_name=>({column_name}))};
    if(sql.includes('CROSS JOIN LATERAL')){
      aggregates++;
      throw Object.assign(Error('grouped syntax incompatible'),{code:'0A000'});
    }
    throw Error('Unexpected legacy fallback work for '+n+' opinions');
   }};
   pool.connect=async()=>({query:pool.query.bind(pool),release(){}});

   await assert.rejects(
    scope?getTerritorialSurveyStats(pool,questions,scope,{warn:()=>{}})
      :getNationalSurveyStats(pool,questions,{warn:()=>{}}),
    e=>e.code==='SONDAGGI_FALLBACK_LIMIT'
   );
   assert.equal(queries,n>256?4:2,
    'one metadata and one grouped attempt, plus snapshot BEGIN/ROLLBACK when needed');
   assert.equal(aggregates,1);
  }
 }
});


test('multi-batch snapshots reject pools without checkout, rather than silently mixing consent versions',async()=>{
 const questions=Array.from({length:300},(_,i)=>({id:'op'+i}));
 const fake={query:async()=>{throw Error('Must refuse before any query')}};
 for(const scope of [null,...GEO_SCOPES]){
  await assert.rejects(
   scope?getTerritorialSurveyStats(fake,questions,scope):getNationalSurveyStats(fake,questions),
   /transaction-capable pool/
  );
 }
});


test('opt-in direct-filter SQL keeps the four real route contracts and remains default-off',async()=>{
 const name='SONDAGGI_EXPERIMENTAL_DIRECT_FILTER';
 const before=process.env[name];
 const beforeCI=process.env.SONDAGGI_TEXT_CI;
 const beforeActions=process.env.GITHUB_ACTIONS;
 const {buildDirectFilterTextAggregateQuery}=require('../utils/sondaggiTextBulk');
 try{
  process.env.GITHUB_ACTIONS='true';
  process.env.SONDAGGI_TEXT_CI='isolated';
  for(const mode of ['unset','false','true']){
   if(mode==='unset')delete process.env[name];
   else process.env[name]=mode;
   for(const scope of [null,...GEO_SCOPES]){
    const {pool,calls}=fakePool();
    const stats=scope?
      await getTerritorialSurveyStats(pool,QUESTIONS,scope):
      await getNationalSurveyStats(pool,QUESTIONS);
    assert.deepEqual(stats,EXPECTED);
    assert.equal(calls.length,2);
    const query=calls[1].sql;
    assert.match(query,/CROSS JOIN LATERAL \(VALUES/);
    assert.equal(query.includes('FROM (SELECT COUNT(*) FILTER'),
      mode==='true','Enabled only with exact opt-in: '+mode);
    assert.match(query,/u.account_type = 'PERSON'/);
    assert.match(query,/COALESCE\(uc.political_opinions_consent/);
    if(scope)assert.deepEqual(calls[1].params,scope.params);
   }
  }
  for(const invalid of [
   [],['caccia','caccia'],['A'],['x";DROP TABLE users;--'],
   Array.from({length:257},(_,i)=>'op'+i)
  ]){
   assert.throws(()=>buildDirectFilterTextAggregateQuery(invalid));
  }
  const query=buildDirectFilterTextAggregateQuery(['caccia','nato'],
    {scope:'comune',params:['TO','PI','Pisa']});
  assert.match(query,/orr."caccia" = 'f'/);
  assert.match(query,/u.comune_residenza = \$3/);
  assert.doesNotMatch(query,/Pisa|DROP TABLE|UPDATE users/);
  assert.throws(()=>buildDirectFilterTextAggregateQuery(['caccia'],
    {scope:'unknown',params:['TO']}));
  // Production, even with an accidental experimental flag, must use
  // the known-good grouped query. The UI flag is not sufficient alone.
  delete process.env.GITHUB_ACTIONS;
  delete process.env.SONDAGGI_TEXT_CI;
  process.env[name]='true';
  const prod=fakePool();
  await getNationalSurveyStats(prod.pool,QUESTIONS);
  assert.doesNotMatch(prod.calls[1].sql,/FROM \(SELECT COUNT\(\*\) FILTER/);
 }finally{
  if(before===undefined)delete process.env[name];
  else process.env[name]=before;
  if(beforeCI===undefined)delete process.env.SONDAGGI_TEXT_CI;
  else process.env.SONDAGGI_TEXT_CI=beforeCI;
  if(beforeActions===undefined)delete process.env.GITHUB_ACTIONS;
  else process.env.GITHUB_ACTIONS=beforeActions;
 }
});


test('legacy fallback holds a single read-only connection and commits in each scope',async()=>{
 for(const scope of [null,...GEO_SCOPES]){
  const {pool}=fakePool({failGrouped:true});
  const baseQuery=pool.query.bind(pool);
  const queries=[],releases=[];
  let checkouts=0;
  pool.connect=async()=>{
   checkouts++;
   return {
    async query(sql,params){
     const text=String(sql).trim();
     queries.push(text);
     if(text.startsWith('BEGIN TRANSACTION'))return {rows:[]};
     if(text==='COMMIT'||text==='ROLLBACK')return {rows:[]};
     return baseQuery(sql,params);
    },
    release(damaged){releases.push(damaged);}
   };
  };
  const stats=scope?
   await getTerritorialSurveyStats(pool,QUESTIONS,scope,{warn:()=>{}}):
   await getNationalSurveyStats(pool,QUESTIONS,{warn:()=>{}});
  assert.deepEqual(stats,EXPECTED);
  assert.equal(checkouts,1);
  assert.match(queries[0],/^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY$/);
  assert.equal(queries.at(-1),'COMMIT');
  assert.equal(queries.filter(q=>q==='COMMIT').length,1);
  assert.equal(queries.filter(q=>q==='ROLLBACK').length,0);
  assert.deepEqual(releases,[false]);
  assert.equal(queries.filter(q=>q.includes('FROM opinioni_risposte orr')).length,3);
 }
});

test('legacy fallback rolls back failures and discards a broken connection',async()=>{
 const {pool}=fakePool({failGrouped:true});
 const orig=pool.query.bind(pool);
 const sql=[],released=[];
 pool.connect=async()=>({
  async query(q,params){
   const text=String(q).trim();
   sql.push(text);
   if(text.startsWith('BEGIN TRANSACTION'))return {rows:[]};
   if(text==='ROLLBACK')throw Error('synthetic wire lost; rollback impossible');
   if(text.includes('FROM opinioni_risposte orr')){
    throw Object.assign(Error('broken connection'),{code:'08006'});
   }
   return orig(q,params);
  },
  release(damaged){released.push(damaged);}
 });
 await assert.rejects(getNationalSurveyStats(pool,QUESTIONS,{warn:()=>{}}),
  err=>err.code==='08006');
 assert.equal(sql.filter(q=>q==='ROLLBACK').length,1);
 assert.ok(!sql.includes('COMMIT'));
 assert.deepEqual(released,[true],'A broken rollback connection must not re-enter the pool');
});
