'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const full = fs.readFileSync(path.join(__dirname, '../routes/governo.js'), 'utf8');
const start = full.indexOf('// GET /api/governo/consenso -');
const end = full.indexOf('// POST /api/governo/consenso -', start);
assert.ok(start >= 0 && end > start);
const source = full.slice(start, end);

function assertConsentSql(sql) {
  assert.match(sql, /JOIN users u ON u\.id::text = cg\.userid::text/);
  assert.match(sql, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
  assert.match(sql, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
}

async function perform({
  granted = true,
  tokenValid = true,
  authenticated = true,
  failDb = false,
  finalRevocation = false,
  noVote = false
} = {}) {
  let handlers;
  const queries = [], calls = [], logs = [];
  let checkNumber = 0;
  const pool = {
    async query(sql, params) {
      const q = String(sql).replace(/\s+/g, ' ').trim();
      queries.push(q);
      if (failDb) throw Error('synthetic-secret-sql-message');
      if (q.startsWith('SELECT cg.risposta, cg.timestamp')) {
        assertConsentSql(q);
        assert.match(q, /WHERE cg\.userid::text = \$1::text/);
        assert.deepEqual(Array.from(params), ['synthetic-user']);
        return { rows: granted && !noVote
          ? [{ risposta: 'Sì', timestamp: '2026-10-25T10:00:00Z' }] : [] };
      }
      if (q.startsWith('SELECT cg.risposta, COUNT(*)::integer')) {
        assertConsentSql(q);
        return { rows: granted ? [{ risposta: 'Sì', conteggio: 1 }] : [] };
      }
      throw Error('Unexpected synthetic query: ' + q);
    }
  };
  const router = { get(p, ...args) {
    assert.equal(p, '/consenso');
    handlers = args;
  }};
  vm.runInNewContext(source, {
    pool, router,
    verifyAccessToken(token) {
      assert.equal(token, 'synthetic');
      if (!tokenValid) throw Error('synthetic-sensitive-token-error');
      return { userId: 'synthetic-user' };
    },
    getPoliticalConsentState: async (db, userId) => {
      assert.equal(db, pool);
      assert.equal(userId, 'synthetic-user');
      checkNumber++;
      return { exists: true, granted: granted && (!finalRevocation || checkNumber < 2) };
    },
    getPreferenceCooldown: async (db, opts) => {
      assert.equal(db, pool);
      assert.equal(opts.userId, 'synthetic-user');
      calls.push(opts.scope);
      return { isBlocked: true, unlockDate: '2026-10-26T10:00:00Z' };
    },
    console: {
      log: (...args) => logs.push(args),
      warn: (...args) => logs.push(args),
      error: (...args) => logs.push(args)
    },
    Object, Number
  }, { filename: 'government-confidence-get.js' });
  assert.equal(handlers.length, 2);
  const res = {
    statusCode: 200, headers: {}, body: null,
    set(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = { headers: authenticated ? { authorization: 'Bearer synthetic', 'x-sensitive-test-header': 'secret-header' } : {} };
  let nextCalled = false;
  await handlers[0](req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  await handlers[1](req, res);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)no-store(?:,|$)/);
  const serializedLogs = JSON.stringify(logs);
  for (const secret of ['synthetic', 'secret-header', 'synthetic-sensitive-token-error', 'synthetic-secret-sql-message']) {
    assert.equal(serializedLogs.includes(secret), false, 'Sensitive value was logged: ' + secret);
  }
  return { res, queries, calls, checkNumber };
}

test('active consent includes own preference and consented aggregate in a no-store response', async () => {
  const { res, queries, calls, checkNumber } = await perform();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.mioConsenso.risposta, 'Sì');
  assert.equal(res.body.data.statistiche['Sì'], 1);
  assert.equal(res.body.data.statistiche.totale, 1);
  assert.equal(res.body.data.blocco.isBlocked, true);
  assert.deepEqual(Array.from(calls), ['governo:consenso']);
  assert.equal(checkNumber, 2);
  assert.equal(queries.length, 2);
});

test('revoked consent hides residual preference and cooldown, and excludes votes from totals', async () => {
  const { res, queries, calls } = await perform({ granted: false });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.mioConsenso, null);
  assert.equal(res.body.data.statistiche.totale, 0);
  assert.equal(res.body.data.blocco.isBlocked, false);
  assert.deepEqual(Array.from(calls), []);
  assert.equal(queries.length, 2);
});

test('revocation between vote read and final consent check suppresses personal response', async () => {
  const { res } = await perform({ finalRevocation: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.mioConsenso, null);
  assert.equal(res.body.data.blocco.isBlocked, false);
});

test('anonymous or invalid access token cannot retrieve private preference or cooldown', async () => {
  for (const options of [{ authenticated: false }, { tokenValid: false }]) {
    const { res, queries, calls, checkNumber } = await perform(options);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.mioConsenso, null);
    assert.equal(res.body.data.blocco.isBlocked, false);
    assert.equal(queries.length, 1);
    assert.ok(queries[0].startsWith('SELECT cg.risposta, COUNT(*)::integer'));
    assert.equal(calls.length, 0);
    assert.equal(checkNumber, 0);
  }
});

test('consented voter with no current preference preserves cooldown information', async () => {
  const { res, calls } = await perform({ noVote: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.mioConsenso, null);
  assert.equal(res.body.data.blocco.isBlocked, true);
  assert.equal(calls.length, 1);
});

test('database failure returns sanitized error without token, SQL detail or cached result', async () => {
  const { res } = await perform({ failDb: true });
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('synthetic-secret-sql-message'), false);
});

test('CDN bypass includes public/government consent and personalized responses', () => {
  const policy = require('../config/publicCachePolicy');
  for (const p of ['/api/governo/consenso', '/api/governo/voti']) {
    assert.ok(policy.neverCachePathPrefixes.some(prefix => p.startsWith(prefix)), p);
  }
});

test('GET handler never prints request headers, token payloads, or personal answers', () => {
  assert.doesNotMatch(source, /console\.(?:log|warn)\s*\(/);
  assert.doesNotMatch(source, /req\.headers\W*[),]/);
  assert.doesNotMatch(source, /console\.error\([^)]*error/);
});
