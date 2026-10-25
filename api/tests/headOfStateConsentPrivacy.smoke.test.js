'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/capo-stato.js'), 'utf8');
const start = source.indexOf('// ===== ENDPOINTS PER CONSENSO CAPO DI STATO =====');
const end = source.indexOf('module.exports = router;', start);
assert.ok(start >= 0 && end > start, 'Expected head-of-state consent GET/POST routes');
const block = source.slice(start, end);

async function request(method, {
  granted = true, override = null, userExists = true, existing = null,
  writeFails = false, authenticated = true, validToken = true, response = 'No'
} = {}) {
  const routes = {};
  const sequence = [];
  const logs = [];
  let released = false;
  const effectiveConsent = override === null ? granted : override;
  const assertConsentSql = (sql) => {
    assert.match(sql, /JOIN users u ON u\.id::text = cc\.userid::text/);
    assert.match(sql, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
    assert.match(sql, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
  };
  const client = {
    async query(sql) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) {
        sequence.push(s);
        return { rows: [] };
      }
      if (s === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
        sequence.push('LOCK');
        return { rows: userExists ? [{ id: 'synthetic-user' }] : [] };
      }
      if (s.startsWith('SELECT risposta, timestamp FROM consenso_capo_stato WHERE userid')) {
        sequence.push('READ_EXISTING');
        return { rows: existing ? [{ risposta: existing, timestamp: '2026-10-24T12:00:00Z' }] : [] };
      }
      if (s.startsWith('DELETE FROM consenso_capo_stato')) {
        sequence.push('DELETE');
        return { rowCount: 1, rows: [] };
      }
      if (s.startsWith('INSERT INTO consenso_capo_stato')) {
        sequence.push('INSERT');
        if (writeFails) throw new Error('synthetic private write failure');
        return { rowCount: 1, rows: [] };
      }
      throw new Error('Unexpected synthetic client SQL: ' + s);
    },
    release() { released = true; sequence.push('RELEASE'); }
  };
  const pool = {
    async connect() { sequence.push('CONNECT'); return client; },
    async query(sql) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      assertConsentSql(s);
      if (s.startsWith('SELECT cc.risposta, cc.timestamp')) {
        sequence.push('GET_PERSONAL');
        return { rows: effectiveConsent ? [{ risposta: 'Sì', timestamp: '2026-10-24T12:00:00Z' }] : [] };
      }
      if (s.startsWith('SELECT cc.risposta, COUNT(*) AS conteggio')) {
        sequence.push('GET_AGGREGATE');
        return { rows: effectiveConsent ? [{ risposta: 'Sì', conteggio: '1' }] : [] };
      }
      throw new Error('Unexpected synthetic pool SQL: ' + s);
    }
  };
  const passthrough = (_req, _res, next) => next();
  const verifyToken = (_req, res, next) => authenticated
    ? next()
    : res.status(401).json({ success: false });
  const router = {
    get(path, ...handlers) { assert.equal(path, '/consenso'); routes.GET = handlers; },
    post(path, ...handlers) { assert.equal(path, '/consenso'); routes.POST = handlers; }
  };
  vm.runInNewContext(block, {
    router, pool, verifyToken,
    requireVerifiedCivicIdentity: passthrough, requirePoliticalConsent: passthrough,
    jwt: { verify() {
      if (!validToken) throw new Error('Invalid synthetic token');
      return { userId: 'synthetic-user' };
    } },
    process: { env: { JWT_SECRET: 'synthetic-only' } },
    getPreferenceCooldown: async () => ({ isBlocked: false, unlockDate: null }),
    getPoliticalConsentState: async (db, id) => {
      assert.equal(db, client);
      assert.equal(id, 'synthetic-user');
      sequence.push('CONSENT');
      return { exists: userExists, granted: effectiveConsent };
    },
    assertPreferenceChangeAllowed: async (db) => {
      assert.equal(db, client);
      sequence.push('COOLDOWN');
    },
    recordPreferenceChange: async (db) => {
      assert.equal(db, client);
      sequence.push('RECORD');
    },
    sendCooldownError: () => false,
    console: {
      log: (...args) => logs.push(args.join(' ')),
      warn: (...args) => logs.push(args.join(' ')),
      error: (...args) => logs.push(args.join(' '))
    }
  }, { filename: 'routes/capo-stato-consent.js' });

  const res = {
    statusCode: 200, headers: {}, body: null,
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = {
    headers: { authorization: 'Bearer synthetic-secret' },
    userId: 'synthetic-user',
    user: { id: 'synthetic-user', isAdmin: false },
    body: { risposta: response }
  };
  if (method === 'GET' && !authenticated) delete req.headers.authorization;
  const handlers = routes[method];
  assert.ok(handlers && handlers.length > 1, 'Expected no-store middleware before route');
  for (const handler of handlers) {
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
  assert.match(res.headers['cache-control'] || '', /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'] || '', /(?:^|,\s*)no-store(?:,|$)/);
  assert.equal(logs.join(' ').includes('synthetic-secret'), false, 'Bearer tokens must not be logged');
  return { res, sequence, released };
}

test('POST locks user, rechecks consent, then changes preference atomically', async () => {
  const { res, sequence, released } = await request('POST', { existing: 'Sì' });
  assert.equal(res.statusCode, 200);
  assert.equal(released, true);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'READ_EXISTING', 'COOLDOWN', 'DELETE', 'INSERT', 'RECORD', 'COMMIT', 'RELEASE']);
});

test('POST revocation wins lock: no read/write, 403, rollback on same client', async () => {
  const { res, sequence, released } = await request('POST', { granted: false, existing: 'Sì' });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'POLITICAL_CONSENT_REQUIRED');
  assert.equal(res.body.consent_required, true);
  assert.equal(released, true);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'ROLLBACK', 'RELEASE']);
});

test('POST consent override revoked blocks a residual choice', async () => {
  const { res, sequence } = await request('POST', { granted: true, override: false, existing: 'Sì' });
  assert.equal(res.statusCode, 403);
  assert.equal(sequence.includes('DELETE'), false);
});

test('POST unchanged preference and missing account do not mutate data', async () => {
  const same = await request('POST', { existing: 'No' });
  assert.equal(same.res.statusCode, 200);
  assert.deepEqual(same.sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'READ_EXISTING', 'ROLLBACK', 'RELEASE']);
  const missing = await request('POST', { userExists: false });
  assert.equal(missing.res.statusCode, 404);
  assert.deepEqual(missing.sequence, ['CONNECT', 'BEGIN', 'LOCK', 'ROLLBACK', 'RELEASE']);
});

test('POST insert failure rolls back on acquired client, never records cooldown', async () => {
  const { res, sequence, released } = await request('POST', { existing: 'Sì', writeFails: true });
  assert.equal(res.statusCode, 500);
  assert.equal(released, true);
  assert.equal(JSON.stringify(res.body).includes('synthetic private write failure'), false);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'READ_EXISTING', 'COOLDOWN', 'DELETE', 'INSERT', 'ROLLBACK', 'RELEASE']);
});

test('POST unauthorized response carries no-store before authentication', async () => {
  const { res, sequence } = await request('POST', { authenticated: false });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(sequence, []);
});

test('GET returns only consent-authorized personal choice and aggregates', async () => {
  const { res, sequence } = await request('GET');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.mioConsenso.risposta, 'Sì');
  assert.equal(res.body.data.statistiche.totale, 1);
  assert.deepEqual(sequence, ['GET_PERSONAL', 'GET_AGGREGATE']);
});

test('GET revoked consent hides residual personal choice and aggregate', async () => {
  for (const opts of [{ granted: false }, { granted: true, override: false }]) {
    const { res, sequence } = await request('GET', opts);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.mioConsenso, null);
    assert.equal(res.body.data.statistiche.totale, 0);
    assert.deepEqual(sequence, ['GET_PERSONAL', 'GET_AGGREGATE']);
  }
});

test('GET anonymous/invalid-token responses remain private no-store', async () => {
  const anonymous = await request('GET', { authenticated: false });
  assert.equal(anonymous.res.body.data.mioConsenso, null);
  assert.deepEqual(anonymous.sequence, ['GET_AGGREGATE']);
  const invalid = await request('GET', { validToken: false });
  assert.equal(invalid.res.body.data.mioConsenso, null);
  assert.deepEqual(invalid.sequence, ['GET_AGGREGATE']);
});

test('CDN policy and revocation cleanup include head-of-state consent', () => {
  const policy = require('../config/publicCachePolicy');
  assert.ok(policy.neverCachePathPrefixes.includes('/api/capo-stato/consenso'));
  const consentService = fs.readFileSync(path.join(__dirname, '../services/politicalConsentService.js'), 'utf8');
  assert.match(consentService, /'consenso_capo_stato'/);
});
