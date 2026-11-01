'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { getAllOpinions } = require('../services/opinionCatalog');

const authPath = require.resolve('../middleware/auth');
const routePath = require.resolve('../routes/opinioni/user-answers');
const OWNER = 'synthetic-compass-owner';
const FOREIGN = 'synthetic-other-user';
const fixtures = getAllOpinions();
const chosen = ['patrimoniale', 'matrimonio_gay', 'legalizzazione_canapa'];

async function runFixture({consent=true, existing=true, fail=false, values={
  patrimoniale: 'f', matrimonio_gay: 'c', legalizzazione_canapa: 'i',
}}, action) {
  const prior = new Map([authPath, routePath].map(k => [k, require.cache[k]]));
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({sql,params});
      if (fail) throw Error('internal SQL connection string and secret: do not leak');
      assert.deepEqual(params, [OWNER], 'Never read another account');
      assert.match(sql, /FROM users u/);
      assert.match(sql, /LEFT JOIN user_consents uc/);
      assert.match(sql, /FROM opinioni_risposte a/);
      assert.match(sql, /COALESCE\(uc\.political_opinions_consent/);
      assert.match(sql, /AND COALESCE\(uc\.political_opinions_consent/);
      assert.doesNotMatch(sql, /SELECT \*/);
      assert.doesNotMatch(sql, /fonti_opinioni/);
      assert.equal((sql.match(/SELECT[\s\S]*FROM opinioni_risposte a/g)||[]).length,1);
      const selected = Object.fromEntries(fixtures.map(({id}) => [id, values[id] ?? null]));
      return {rows:existing?[{granted:consent, selected_answers:consent?selected:null}]:[]};
    },
  };
  require.cache[authPath] = {id:authPath,filename:authPath,loaded:true,exports:{
    pool,
    verifyToken(req,res,next) {
      if (req.headers.authorization !== 'Bearer synthetic-owner') {
        return res.status(401).json({success:false,error:'Non autenticato'});
      }
      req.userId = OWNER;
      req.user = {id: OWNER};
      next();
    },
    requireAdmin(_req,_res,next) { next(); },
  }};
  delete require.cache[routePath];
  let server;
  try {
    const app=express();
    app.use('/api/opinioni', require(routePath));
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const get = async (url,authorized=true) => {
      const res=await fetch(base+url,{headers:authorized?{authorization:'Bearer synthetic-owner'}:{}});
      return {status:res.status,headers:res.headers,body:await res.json()};
    };
    await action({get,calls});
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    for(const [k,v] of prior) { if(v)require.cache[k]=v;else delete require.cache[k]; }
  }
}

test('legacy catalog-only profile remains zero SQL and excludes answers',async()=>{
  await runFixture({},async({get,calls})=>{
    const {status,body}=await get('/api/opinioni/profile');
    assert.equal(status,200);
    assert.equal(body.data.questions.length,94);
    assert.equal(Object.hasOwn(body.data,'userAnswers'),false);
    assert.equal(calls.length,0);
  });
});

test('owner opt-in receives only own catalog answers in one consent-guarded SELECT',async()=>{
  await runFixture({},async({get,calls})=>{
    const {status,body,headers}=await get('/api/opinioni/profile?includeAnswers=1&userId='+FOREIGN);
    assert.equal(status,200);
    assert.equal(body.data.questions.length,94);
    assert.deepEqual(Object.keys(body.data.userAnswers).sort(),chosen.slice().sort());
    assert.equal(body.data.userAnswers.patrimoniale,'f');
    assert.equal(body.data.userAnswers.matrimonio_gay,'c');
    assert.equal(body.data.userAnswers.legalizzazione_canapa,'i');
    assert.equal(Object.hasOwn(body.data,'fonti'),false);
    assert.equal(calls.length,1,'Only one server-side SQL query is permitted');
    assert.deepEqual(calls[0].params,[OWNER]);
    assert.match(headers.get('cache-control'),/private.*no-store/);
  });
});

test('revoked or absent political consent yields no answers and private 403',async()=>{
  await runFixture({consent:false},async({get,calls})=>{
    const {status,body,headers}=await get('/api/opinioni/profile?includeAnswers=1');
    assert.equal(status,403);
    assert.equal(body.consent_required,true);
    assert.equal(JSON.stringify(body).includes('patrimoniale'),false);
    assert.equal(calls.length,1);
    assert.match(headers.get('cache-control'),/no-store/);
  });
});

test('no answer row is a real empty map rather than an endpoint contract failure',async()=>{
  await runFixture({values:{}},async({get})=>{
    const {status,body}=await get('/api/opinioni/profile?includeAnswers=1');
    assert.equal(status,200);
    assert.deepEqual(body.data.userAnswers,{});
  });
});

test('missing user and SQL failure fail closed without exposing details',async()=>{
  for(const opts of [{existing:false},{fail:true}]){
    await runFixture(opts,async({get})=>{
      const {status,body,headers}=await get('/api/opinioni/profile?includeAnswers=1');
      assert.equal(status,opts.fail?500:404);
      assert.equal(Object.hasOwn(body,'data'),false);
      assert.doesNotMatch(JSON.stringify(body),/internal SQL|connection string|secret/);
      assert.match(headers.get('cache-control'),/no-store/);
    });
  }
});

test('not authenticated: no SQL request for opted-in personal data',async()=>{
  await runFixture({},async({get,calls})=>{
    const {status,body}=await get('/api/opinioni/profile?includeAnswers=1',false);
    assert.equal(status,401);
    assert.equal(Object.hasOwn(body,'data'),false);
    assert.equal(calls.length,0);
  });
});
