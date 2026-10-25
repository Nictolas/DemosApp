'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routeSource = fs.readFileSync(path.join(__dirname, '../routes/compatibility.js'), 'utf8');
const cachePolicy = require('../config/publicCachePolicy');

function createSyntheticHandler({ validToken = true, activeUser = true, userConsent = true, consentOverride = null } = {}) {
  let handler;
  const queries = [];
  const pool = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('SELECT id, status, ruolo FROM users')) {
        return { rows: [{ id: 'synthetic-user', status: activeUser ? 'a' : 's', ruolo: 'c' }] };
      }
      if (sql.includes('FROM opinioni_domande o')) {
        return { rows: [{ id: 'caccia', text: 'Caccia', gradi_opinione: ['N'] }] };
      }
      if (sql.includes('FROM opinioni_risposte')) {
        // This route must never load a personal answer without an Art. 9
        // consent predicate in the same statement (not a stale precheck).
        assert.match(sql, /JOIN users u ON u\.id = r\.user_id/);
        assert.match(sql, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
        assert.match(sql, /COALESCE\([\s\S]*uc\.political_opinions_consent,[\s\S]*u\.political_opinions_consent,[\s\S]*false[\s\S]*\)\s*= true/);
        const granted = consentOverride === null ? userConsent : consentOverride;
        return { rows: granted ? [{ user_id: 'synthetic-user', caccia: 'f' }] : [] };
      }
      throw new Error('Unexpected synthetic SQL');
    },
  };
  const fakeRequire = (id) => {
    if (id === 'express') {
      return { Router: () => ({ get(route, fn) {
        if (route === '/opinioni-list') handler = fn;
      } }) };
    }
    if (id === '../middleware/auth') return { pool };
    if (id === '../utils/jwt') {
      return { verifyAccessToken: () => {
        if (!validToken) throw new Error('Invalid synthetic token');
        return { userId: 'synthetic-user' };
      } };
    }
    throw new Error('Unexpected dependency: ' + id);
  };
  const moduleStub = { exports: {} };
  vm.runInNewContext(routeSource, {
    module: moduleStub,
    exports: moduleStub.exports,
    require: fakeRequire,
    process: { env: { NODE_ENV: 'production' } },
    console: { log() {}, error() {} },
  }, { filename: 'routes/compatibility.js' });
  assert.equal(typeof handler, 'function', 'Expected mounted personalized route');
  return { handler, queries };
}

function responseStub() {
  return {
    statusCode: 200,
    headers: {},
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function assertNoStore(res) {
  const header = res.headers['cache-control'];
  assert.match(header || '', /(?:^|,\s*)no-store(?:,|$)/);
  assert.match(header || '', /(?:^|,\s*)private(?:,|$)/);
}

test('personalized /api/opinioni-list is explicitly excluded from CDN cache policy', () => {
  assert.ok(cachePolicy.neverCachePathPrefixes.some(
    (prefix) => '/api/opinioni-list'.startsWith(prefix)
  ));
  assert.ok(!cachePolicy.cacheableApiGetPaths.some(
    ({ pattern }) => pattern === '/api/opinioni-list'
  ));
  const appSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  assert.match(appSource, /app\.use\('\/api', compatibilityRoutes\)/);
});

test('successful personalized opinion response sends private no-store header', async () => {
  const { handler, queries } = createSyntheticHandler();
  const res = responseStub();
  await handler({ headers: { authorization: 'Bearer synthetic' }, query: { grado: 'N' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].userAnswer, 'f');
  assert.ok(queries.some((sql) => sql.includes('FROM opinioni_risposte')));
  assertNoStore(res);
});

test('revoked Art. 9 consent suppresses residual political answers without hiding public questions', async () => {
  // Simulate a leftover answer row: the SQL consent predicate must filter it.
  for (const options of [
    { userConsent: false, consentOverride: null },
    { userConsent: true, consentOverride: false },
  ]) {
    const { handler, queries } = createSyntheticHandler(options);
    const res = responseStub();
    await handler({ headers: { authorization: 'Bearer synthetic' }, query: { grado: 'N' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 1, 'public question should remain visible');
    assert.equal(res.body.data[0].userAnswer, null, 'private answer must be absent');
    assert.ok(queries.some(sql => sql.includes('FROM opinioni_risposte')));
    assertNoStore(res);
  }
});

test('consent override preserves authorized personal opinion reads', async () => {
  const { handler } = createSyntheticHandler({ userConsent: false, consentOverride: true });
  const res = responseStub();
  await handler({ headers: { authorization: 'Bearer synthetic' }, query: { grado: 'N' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].userAnswer, 'f');
  assertNoStore(res);
});

test('missing/invalid authentication cannot produce cacheable error responses', async () => {
  for (const [options, authorization] of [
    [{}, undefined],
    [{ validToken: false }, 'Bearer invalid'],
    [{ activeUser: false }, 'Bearer synthetic'],
  ]) {
    const { handler } = createSyntheticHandler(options);
    const res = responseStub();
    await handler({ headers: authorization ? { authorization } : {}, query: { grado: 'N' } }, res);
    assert.equal(res.statusCode, 401);
    assertNoStore(res);
  }
});

test('validation errors also carry private no-store', async () => {
  const { handler } = createSyntheticHandler();
  const res = responseStub();
  await handler({ headers: { authorization: 'Bearer synthetic' }, query: {} }, res);
  assert.equal(res.statusCode, 400);
  assertNoStore(res);
});
