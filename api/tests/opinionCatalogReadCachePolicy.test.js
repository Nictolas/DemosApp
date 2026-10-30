'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/compatibility.js'), 'utf8');
const policy = require('../config/publicCachePolicy.js');

function handlers({ validToken = true, active = true, sensitiveJwtError = null, sensitiveDbError = null } = {}) {
  const routes = new Map(), sql = [], logs = [];
  const fakeRequire = (name) => {
    if (name === 'express') return { Router: () => ({
      get(key, handler) { routes.set(key, handler); },
    }) };
    if (name === '../services/opinionCatalog') return {
      getOpinionCatalogRevision: () => 'b'.repeat(64),
      getOpinionsForGrade: () => [{ id: 'caccia', text: 'Caccia', gradi_opinione: ['N'] }],
      sortOpinionsByText: items => items,
    };
    if (name === '../services/politicalJurisdictionRegistryService') {
      return { normalizeOpinionScope: value => value };
    }
    if (name === '../middleware/auth') return { pool: {
      async query(query, params) {
        sql.push(String(query));
        if (sensitiveDbError) throw new Error(sensitiveDbError);
        assert.deepEqual(Array.from(params), ['synthetic-user']);
        return { rows: [{ id: 'synthetic-user', status: active ? 'a' : 's',
          ruolo: 'E', opinion_answers: { caccia: 'f' } }] };
      },
    } };
    if (name === '../utils/jwt') return { verifyAccessToken() {
      if (!validToken) throw new Error(sensitiveJwtError || 'Synthetic invalid token');
      return { userId: 'synthetic-user' };
    } };
    throw new Error('Unexpected dependency ' + name);
  };
  const moduleStub = { exports: {} };
  vm.runInNewContext(source, {
    require: fakeRequire, module: moduleStub, exports: moduleStub.exports,
    console: { log() {}, error(...args) { logs.push(args); } }, process: { env: { NODE_ENV: 'production' } },
  });
  return { routes, sql, logs };
}
function response() {
  return { statusCode: 200, headers: {}, set(k,v) {
    this.headers[k.toLowerCase()] = v; return this;
  }, status(status) { this.statusCode=status; return this; },
  json(body) { this.body=body; return this; } };
}
test('personal response is no-store, catalog manifest is public metadata only', async () => {
  const { routes, sql } = handlers();
  const manifest = response();
  await routes.get('/opinioni-catalog-revision')({},manifest);
  assert.equal(manifest.statusCode, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(manifest.body)), {
    success:true, revision:'b'.repeat(64),
  });
  assert.match(manifest.headers['cache-control'], /public, max-age=300/);
  assert.equal(sql.length, 0, 'catalog manifest must not query user DB');
  const privateRes = response();
  await routes.get('/opinioni-list')({ headers:{ authorization:'Bearer synthetic' },
    query:{ grado:'N' } }, privateRes);
  assert.equal(privateRes.statusCode,200);
  assert.equal(privateRes.body.data[0].userAnswer,'f');
  assert.match(privateRes.headers['cache-control'], /private, no-store/);
  assert.equal(sql.length,1,'one DB read for personalized answers');
});
test('unauthenticated, invalid, inactive and missing-grade responses are no-store', async () => {
  for (const [options, auth, grade, expected] of [
    [{}, null, 'N', 401],
    [{validToken:false}, 'Bearer invalid', 'N', 401],
    [{active:false}, 'Bearer synthetic', 'N', 401],
    [{}, 'Bearer synthetic', undefined, 400],
  ]) {
    const { routes } = handlers(options), res = response();
    await routes.get('/opinioni-list')({
      headers: auth ? {authorization:auth} : {}, query: grade ? {grado:grade} : {},
    }, res);
    assert.equal(res.statusCode,expected);
    assert.match(res.headers['cache-control'], /private, no-store/);
  }
});
test('legacy personalized path cannot be stored at CDN/edge',()=>{
  assert.ok(policy.neverCachePathPrefixes.some(prefix =>
    '/api/opinioni-list'.startsWith(prefix)));
  assert.ok(!policy.cacheableApiGetPaths.some(({pattern})=>pattern==='/api/opinioni-list'));
});

test('JWT and SQL failures never log raw exception payloads', async () => {
  const marker = 'SENSITIVE_MARKER_JWT_SQL_ACCOUNT_TOKEN';
  for (const [options, expectedStatus] of [
    [{ validToken: false, sensitiveJwtError: marker }, 401],
    [{ sensitiveDbError: marker }, 500],
  ]) {
    const { routes, logs } = handlers(options);
    const res = response();
    await routes.get('/opinioni-list')({
      headers: { authorization: 'Bearer synthetic' },
      query: { grado: 'N' },
    }, res);
    assert.equal(res.statusCode, expectedStatus);
    assert.match(res.headers['cache-control'], /private, no-store/);
    assert.equal(logs.length, 1, 'one fixed diagnostic per failure');
    assert.ok(!JSON.stringify(logs).includes(marker), 'raw exception in logs');
    assert.ok(!JSON.stringify(res.body).includes(marker), 'raw exception in response');
  }
});
