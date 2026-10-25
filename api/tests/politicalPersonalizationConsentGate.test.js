'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { enforcePoliticalPersonalizationConsent } = require('../services/politicalPersonalizationAccessService');

const ROOT = path.join(__dirname, '..');

function syntheticResponse() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function run({ userId = 'synthetic', found = true, granted = true, fail = false } = {}) {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      assert.match(String(sql), /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) AS granted/);
      assert.deepEqual(params, ['synthetic']);
      if (fail) throw Error('synthetic-private-sql-error');
      return { rows: found ? [{ id: 'synthetic', granted }] : [] };
    }
  };
  const res = syntheticResponse();
  const result = await enforcePoliticalPersonalizationConsent(pool, userId, res);
  return { result, res, calls };
}

test('consenso esplicito attivo abilita matching personalizzato', async () => {
  const { result, res, calls } = await run();
  assert.equal(result, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, null);
  assert.equal(calls.length, 1);
});

test('revoca consenso => 403 stabile senza informazioni politiche o stato sensibile', async () => {
  const { result, res, calls } = await run({ granted: false });
  assert.equal(result, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.consent_required, true);
  assert.equal(res.body.code, 'POLITICAL_CONSENT_REQUIRED');
  assert.equal(JSON.stringify(res.body).includes('synthetic'), false);
  assert.equal(calls.length, 1);
});

test('assenza di account e di autenticazione falliscono chiuse', async () => {
  const absent = await run({ found: false });
  assert.equal(absent.res.statusCode, 404);
  const unauthenticated = await run({ userId: '' });
  assert.equal(unauthenticated.res.statusCode, 401);
  assert.deepEqual(unauthenticated.calls, []);
});

test('errore database consenso => 500 sanificato senza permettere il matching', async () => {
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  try {
    const { result, res } = await run({ fail: true });
    assert.equal(result, false);
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(res.body) + JSON.stringify(errors), /synthetic-private-sql-error/);
  } finally {
    console.error = originalError;
  }
});

test('gate prima e dopo la personalizzazione, ma non sui profili pubblici o privacy', () => {
  const candidates = fs.readFileSync(path.join(ROOT, 'routes/candidati.js'), 'utf8');
  const representatives = fs.readFileSync(path.join(ROOT, 'routes/rappresentanti.js'), 'utf8');
  const rights = fs.readFileSync(path.join(ROOT, 'routes/user/political-opinions-consent.js'), 'utf8');
  for (const [source, start, end, expected] of [
    [candidates, "router.get('/europei', verifyToken", "router.get('/disponibili'", 2],
    [candidates, "router.get('/disponibili', verifyToken", "router.put('/seleziona-candidato'", 2],
    [representatives, "router.get('/disponibili', verifyToken", "router.get('/', verifyToken", 2]
  ]) {
    const a = source.indexOf(start), b = source.indexOf(end, a+start.length);
    assert.ok(a >= 0 && b > a);
    const block = source.slice(a,b);
    assert.equal((block.match(/await enforcePoliticalPersonalizationConsent\(pool, userId, res\)/g) || []).length, expected);
    assert.ok(block.indexOf('await enforcePoliticalPersonalizationConsent(pool, userId, res)') < block.indexOf('buildPoliticalMatches('));
    assert.ok(block.lastIndexOf('await enforcePoliticalPersonalizationConsent(pool, userId, res)') > block.indexOf('buildPoliticalMatches('));
  }
  assert.doesNotMatch(rights, /enforcePoliticalPersonalizationConsent/);
  assert.ok(candidates.includes("router.get('/', verifyToken"));
  assert.ok(representatives.includes("router.get('/', verifyToken"));
});

test('grant/revoke endpoints remain distinct from personalized-feature gating', () => {
  const rights = fs.readFileSync(path.join(ROOT, 'routes/user/political-opinions-consent.js'), 'utf8');
  assert.match(rights, /router\.post\('\/', verifyToken/);
  assert.match(rights, /router\.put\('\/revoke', verifyToken/);
  const helper = fs.readFileSync(path.join(ROOT, 'services/politicalPersonalizationAccessService.js'), 'utf8');
  assert.doesNotMatch(helper, /DELETE FROM|UPDATE users|INSERT INTO/);
});
