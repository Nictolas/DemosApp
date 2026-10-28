'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');

const api = path.resolve(__dirname,'..');
const authPath = require.resolve(path.join(api,'middleware/auth.js'));
const answersPath = require.resolve(path.join(api,'routes/opinioni/user-answers.js'));
const userId = 'consent-race-synthetic-user';

async function serveWriteRoute({lockedConsent}, callback) {
  const originalAuth=require.cache[authPath];
  const originalAnswers=require.cache[answersPath];
  const state={ queries:[], writes:0, commits:0, rollbacks:0 };
  const query=async(queryText, params=[])=>{
    const sql=String(queryText).replace(/\s+/g,' ').trim();
    state.queries.push(sql);
    if(sql==='BEGIN')return {rows:[],rowCount:0};
    if(sql==='ROLLBACK'){state.rollbacks++;return {rows:[],rowCount:0};}
    if(sql==='COMMIT'){state.commits++;return {rows:[],rowCount:0};}
    if(sql.includes('FOR UPDATE OF u')){
      assert.deepEqual(params,[userId]);
      return {rows:lockedConsent===null?[]:[{granted:lockedConsent}],rowCount:lockedConsent===null?0:1};
    }
    if(sql.includes('AS granted') && sql.includes('user_consents')){
      assert.deepEqual(params,[userId]);
      // Fast precheck sees consent=TRUE, but the concurrent revoke may
      // commit before the transactional row lock is acquired.
      return {rows:[{granted:true}],rowCount:1};
    }
    if(sql.includes('information_schema.columns') && sql.includes('opinioni_risposte')){
      return {rows:[{column_name:'energia_nucleare'}],rowCount:1};
    }
    if(sql.startsWith('SELECT user_id') && sql.includes('FROM opinioni_risposte') && sql.includes('FOR UPDATE')){
      return {rows:[],rowCount:0};
    }
    if(sql.startsWith('INSERT INTO opinioni_risposte')){
      state.writes++;return {rows:[],rowCount:1};
    }
    if(sql.startsWith('UPDATE opinioni_risposte')){
      state.writes++;return {rows:[],rowCount:1};
    }
    throw Error('Unexpected synthetic SQL: '+sql);
  };
  const pool={query,connect:async()=>({query,release(){}})};
  require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{
    pool,verifyToken:(req,_res,next)=>{req.userId=userId;req.user={id:userId,isPolitician:false,isCandidate:false};next();},
    requireAdmin:(_req,_res,next)=>next()
  }};
  delete require.cache[answersPath];
  const app=express();
  app.use(express.json());
  app.use('/api/opinioni',require(answersPath));
  const server=http.createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    await callback({base,state});
  }finally{
    await new Promise(resolve=>server.close(resolve));
    if(originalAuth)require.cache[authPath]=originalAuth;else delete require.cache[authPath];
    if(originalAnswers)require.cache[answersPath]=originalAnswers;else delete require.cache[answersPath];
  }
}
const post=base=>fetch(base+'/api/opinioni/salva',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({opinioni:{energia_nucleare:'f'}})
});

test('revocation between precheck and row lock returns 403 and writes nothing',async()=>{
  await serveWriteRoute({lockedConsent:false},async({base,state})=>{
    const res=await post(base);
    const data=await res.json();
    assert.equal(res.status,403);
    assert.equal(data.consent_required,true);
    assert.equal(state.writes,0);
    assert.equal(state.commits,0);
    assert.equal(state.rollbacks,1);
    const begin=state.queries.indexOf('BEGIN');
    const lock=state.queries.findIndex(s=>s.includes('FOR UPDATE OF u'));
    assert.ok(begin>=0&&lock>begin);
    assert.equal(state.queries.some(s=>s.includes('SELECT user_id')&&s.includes('FOR UPDATE')),false);
  });
});

test('deleted user after precheck returns 404 and cannot commit',async()=>{
  await serveWriteRoute({lockedConsent:null},async({base,state})=>{
    const res=await post(base);
    assert.equal(res.status,404);
    assert.equal(state.writes,0);
    assert.equal(state.commits,0);
    assert.equal(state.rollbacks,1);
  });
});

test('active consent locked inside transaction allows the existing save contract',async()=>{
  await serveWriteRoute({lockedConsent:true},async({base,state})=>{
    const res=await post(base);
    const data=await res.json();
    assert.equal(res.status,200);
    assert.equal(data.savedCount,1);
    assert.equal(state.writes,1);
    assert.equal(state.commits,1);
    assert.equal(state.rollbacks,0);
    const begin=state.queries.indexOf('BEGIN');
    const lock=state.queries.findIndex(s=>s.includes('FOR UPDATE OF u'));
    const write=state.queries.findIndex(s=>s.startsWith('INSERT INTO opinioni_risposte'));
    assert.ok(begin>=0 && lock>begin && write>lock);
  });
});
