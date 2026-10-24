'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');

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
  assert.equal(calls.length,3,'published questions + column whitelist + single stats query');
  assert.equal(calls.filter(c=>c.sql.includes('FROM opinioni_domande')).length,1);
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
    assert.equal(calls.length,3);
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
