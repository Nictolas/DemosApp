'use strict';
// The current production route bodies run with fake JWT/accounts and a synthetic SQL
// evaluator. No network, provider credentials, database writes or personal data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = p => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const question = { id: 'caccia', text: 'Caccia', gradi_opinione: ['N'] };
const policy = /COALESCE\s*\(\s*uc\.political_opinions_consent\s*,\s*u\.political_opinions_consent\s*,\s*false\s*\)\s+IS\s+TRUE/i;

function response() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    set(key, val) { this.headers[key.toLowerCase()] = val; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
}
function assertNoStore(res) {
  assert.match(res.headers['cache-control'] || '', /private/);
  assert.match(res.headers['cache-control'] || '', /no-store/);
}

function compatibility({ granted = true, override, authenticated = true, status = 'a', dbError = false, hasGrade = true } = {}) {
  const statements = [];
  const pool = {
    async query(sql, values) {
      sql = String(sql);
      statements.push(sql);
      assert.deepEqual(Array.from(values), ['synthetic-owner']);
      assert.match(sql, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
      assert.match(sql, /LEFT JOIN LATERAL/);
      assert.match(sql, /FROM opinioni_risposte a/);
      assert.match(sql, policy);
      assert.match(sql, /row_to_json\(selected\)/);
      if (dbError) throw Error('SYNTHETIC_DB_CREDENTIAL_LEAK');
      const consent = override === undefined ? granted : override;
      return { rows: [{ id: 'synthetic-owner', status, ruolo: 'P',
        opinion_answers: consent === true ? { caccia: 'f' } : null }] };
    }
  };
  let handler;
  const mockRequire = name => {
    if (name === 'express') return { Router: () => ({ get(route, fn) {
      if (route === '/opinioni-list') handler = fn;
    } }) };
    if (name === '../middleware/auth') return { pool };
    if (name === '../utils/jwt') return { verifyAccessToken: () => {
      if (!authenticated) throw Error('INVALID_SYNTHETIC_TOKEN');
      return { userId: 'synthetic-owner' };
    } };
    if (name === '../services/opinionCatalog') return {
      getOpinionsForGrade: () => [question],
      sortOpinionsByText: x => x,
      getOpinionCatalogRevision: () => 'synthetic'
    };
    if (name === '../services/politicalJurisdictionRegistryService') return { normalizeOpinionScope: x => x };
    throw Error('Unexpected dependency ' + name);
  };
  const module = { exports: {} };
  vm.runInNewContext(file('routes/compatibility.js'), {
    module, exports: module.exports, require: mockRequire,
    process: { env: { NODE_ENV: 'production' } },
    console: { log() {}, error() {} }
  });
  assert.equal(typeof handler, 'function');
  return async () => {
    const res = response();
    await handler({
      headers: { authorization: authenticated ? 'Bearer synthetic' : 'Bearer invalid' },
      query: hasGrade ? { grado: 'N' } : {}
    }, res);
    assertNoStore(res);
    return { res, statements };
  };
}

test('opinioni-list: active consent can read an existing personal answer', async () => {
  const { res, statements } = await compatibility()();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].userAnswer, 'f');
  assert.equal(statements.length, 1);
});

test('opinioni-list: revoked, absent and legacy consent with override=false never return residual answers', async () => {
  for (const opts of [{granted:false}, {granted:null}, {granted:true,override:false}]) {
    const {res,statements} = await compatibility(opts)();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 1, 'catalog question remains visible');
    assert.equal(res.body.data[0].userAnswer, null);
    assert.equal(statements.length, 1);
  }
});

test('opinioni-list: explicit override=true restores access only for consented owner', async () => {
  const {res} = await compatibility({granted:false,override:true})();
  assert.equal(res.body.data[0].userAnswer, 'f');
});

test('opinioni-list: invalid token or infrastructure errors never cache or expose raw errors', async () => {
  const unauth = await compatibility({authenticated:false})();
  assert.equal(unauth.res.statusCode, 401);
  assert.equal(unauth.statements.length, 0);
  const broken = await compatibility({dbError:true})();
  assert.equal(broken.res.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(broken.res.body), /SYNTHETIC_DB_CREDENTIAL_LEAK/);
});

test('opinioni-list: missing grade and inactive account are not cacheable', async () => {
  assert.equal((await compatibility({hasGrade:false})()).res.statusCode, 400);
  assert.equal((await compatibility({status:'x'})()).res.statusCode, 401);
});

function profile({ granted=true, override, target='owner', viewer='owner', authenticated=true, exists=true, dbError=false }={}) {
  const src=file('routes/users/profile.js');
  const start=src.indexOf("router.get('/:userId/opinioni'");
  const end=src.indexOf('// PUT /api/users/:userId/opinioni',start);
  assert.ok(start>=0 && end>start);
  let chain;
  const sqls=[];
  const pool={async query(sql,values){
    sql=String(sql);sqls.push(sql);
    assert.match(sql,/FROM opinioni_risposte r/);
    assert.match(sql,/JOIN users u ON u.id = r.user_id/);
    assert.match(sql,/LEFT JOIN user_consents uc ON uc.user_id = u.id/);
    assert.match(sql,policy);
    assert.deepEqual(Array.from(values),['synthetic-target']);
    if(dbError)throw Error('SYNTHETIC_PRIVATE_SQL_ERROR');
    const consent=override===undefined?granted:override;
    return {rows:consent===true?[{user_id:'synthetic-target',caccia:'f',fonti_opinioni:{caccia:'private-synthetic-source'}}]:[]};
  }};
  const router={get(route,...handlers){assert.equal(route,'/:userId/opinioni');chain=handlers;}};
  const verifyToken=(req,res,next)=>authenticated?next():res.status(401).json({success:false});
  const userDataAuditMiddleware=(_req,_res,next)=>next();
  vm.runInNewContext(src.slice(start,end),{
    router,verifyToken,userDataAuditMiddleware,
    getAccountSubject:async()=>exists?{id:'synthetic-target',capabilities:{isCandidate:target==='candidate',isPolitician:target==='politician'}}:null,
    pool,getOpinionsForGrade:()=>[question],getAllOpinions:()=>[question],sortOpinionsByText:x=>x,
    console:{log(){},error(){}}
  },{filename:'profile-opinions-active-handler.js'});
  assert.equal(chain.length,4,'cache guard must be before auth and audit');
  return async()=>{
    const res=response();
    const userId=viewer==='owner'?'synthetic-target':'synthetic-other';
    const req={userId,user:{id:userId,isAdmin:viewer==='admin'},params:{userId:'synthetic-target'},query:{grado:'N'}};
    for(const middleware of chain.slice(0,-1)){
      let advanced=false;
      await middleware(req,res,()=>{advanced=true;});
      if(!advanced)break;
    }
    if(res.body===undefined)await chain.at(-1)(req,res);
    assertNoStore(res);
    return {res,sqls};
  };
}
test('profile: consented owner obtains answer and source; single personal SELECT',async()=>{
  const {res,sqls}=await profile()();
  assert.equal(res.statusCode,200);
  assert.equal(res.body.data.opinioni[0].userAnswer,'f');
  assert.equal(res.body.data.fonti.caccia,'private-synthetic-source');
  assert.equal(sqls.length,1);
});
test('profile: revoked or absent consent suppresses both personal votes and sources',async()=>{
  for(const opts of [{granted:false},{granted:null},{granted:true,override:false},{target:'candidate',viewer:'other',override:false}]){
    const {res}=await profile(opts)();
    assert.equal(res.statusCode,200);
    assert.equal(res.body.data.opinioni[0].userAnswer,null);
    assert.deepEqual(Object.keys(res.body.data.fonti),[]);
    assert.doesNotMatch(JSON.stringify(res.body),/private-synthetic-source/);
  }
});
test('profile: explicit override=true permits authorized candidate profile read',async()=>{
  const {res}=await profile({target:'candidate',viewer:'other',granted:false,override:true})();
  assert.equal(res.statusCode,200);
  assert.equal(res.body.data.opinioni[0].userAnswer,'f');
});
test('profile: unrelated private citizen cannot reveal answers regardless of consent',async()=>{
  const {res,sqls}=await profile({target:'owner',viewer:'other'})();
  assert.equal(res.statusCode,403);
  assert.equal(sqls.length,0);
});
test('profile: auth, missing target and DB failure never cache private data',async()=>{
  const unauth=await profile({authenticated:false})();assert.equal(unauth.res.statusCode,401);
  const missing=await profile({exists:false})();assert.equal(missing.res.statusCode,404);
  const bad=await profile({dbError:true})();assert.equal(bad.res.statusCode,500);
  assert.doesNotMatch(JSON.stringify(bad.res.body),/SYNTHETIC_PRIVATE_SQL_ERROR/);
});
