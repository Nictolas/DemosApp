'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');

const {
  safeOpinionIds, buildNationalTextAggregateQuery, getNationalSurveyStats
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
          throw new Error('simulated one-off metadata failure');
        }
        return { rows: (params[0] || [])
          .filter(id => ['caccia', 'nato', 'sotto_soglia'].includes(id))
          .map(column_name => ({ column_name })) };
      }
      if (sql.includes('CROSS JOIN LATERAL (VALUES')) {
        if (failGrouped) throw new Error('simulated grouping failure');
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
