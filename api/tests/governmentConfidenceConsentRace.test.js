'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const full = fs.readFileSync(path.join(__dirname, '../routes/governo.js'), 'utf8');
const start = full.indexOf('// POST /api/governo/consenso -');
const end = full.indexOf('// ===== ENDPOINTS PER GOVERNO ATTUALE =====', start);
assert.ok(start >= 0 && end > start, 'Expected Government confidence POST');
const route = full.slice(start, end);

async function request({
  consent = true, exists = true, choice = 'Sì', previous = null,
  authenticated = true, insertFails = false, cooldownFails = false,
  commitFails = false
} = {}) {
  let handlers;
  const sequence = [], logs = [];
  let released = false;
  const client = {
    async query(sql, params) {
      const q = String(sql).replace(/\s+/g, ' ').trim();
      if (['BEGIN', 'ROLLBACK'].includes(q)) {
        sequence.push(q);
        return { rows: [] };
      }
      if (q === 'COMMIT') {
        sequence.push('COMMIT');
        if (commitFails) throw Error('synthetic-private-commit-details');
        return { rows: [] };
      }
      if (q === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
        assert.deepEqual(Array.from(params), ['synthetic-user']);
        sequence.push('LOCK');
        return { rows: exists ? [{ id: 'synthetic-user' }] : [] };
      }
      if (q.startsWith('SELECT risposta, timestamp FROM consenso_governo')) {
        assert.deepEqual(Array.from(params), ['synthetic-user']);
        sequence.push('CURRENT');
        return { rows: previous ? [{ risposta: previous, timestamp: '2026-10-24T09:00:00Z' }] : [] };
      }
      if (q === 'DELETE FROM consenso_governo WHERE userid = $1') {
        sequence.push('DELETE');
        return { rows: [], rowCount: previous ? 1 : 0 };
      }
      if (q.startsWith('INSERT INTO consenso_governo')) {
        assert.match(params[0], /^consenso_gov_/);
        assert.equal(params[1], 'synthetic-user');
        assert.equal(params[2], choice);
        sequence.push('INSERT');
        if (insertFails) throw Error('synthetic-private-SQL-details');
        return { rows: [], rowCount: 1 };
      }
      throw Error('Unexpected synthetic statement: ' + q);
    },
    release() { released = true; sequence.push('RELEASE'); }
  };
  const pool = {
    connect: async () => { sequence.push('CONNECT'); return client; },
    query: async () => { throw Error('Sensitive queries cannot bypass locked client'); }
  };
  const pass = (_req, _res, next) => next();
  const router = {
    post(p, ...funcs) { assert.equal(p, '/consenso'); handlers = funcs; }
  };
  vm.runInNewContext(route, {
    router, pool,
    verifyToken: authenticated ? pass : (_req, res) => res.status(401).json({ success: false }),
    requirePoliticalConsent: pass,
    requireVerifiedCivicIdentity: pass,
    getPoliticalConsentState: async (db, id) => {
      assert.equal(db, client);
      assert.equal(id, 'synthetic-user');
      sequence.push('CONSENT');
      return { exists, granted: consent };
    },
    assertPreferenceChangeAllowed: async (db, options) => {
      assert.equal(db, client);
      assert.equal(options.scope, 'governo:consenso');
      sequence.push('COOLDOWN');
      if (cooldownFails) {
        const error = Error('cooldown');
        error.code = 'PREFERENCE_COOLDOWN';
        throw error;
      }
    },
    recordPreferenceChange: async (db, options) => {
      assert.equal(db, client);
      assert.equal(options.scope, 'governo:consenso');
      sequence.push('RECORD');
    },
    sendCooldownError: (res, error) => {
      if (error?.code !== 'PREFERENCE_COOLDOWN') return false;
      res.status(409).json({ success: false, error: 'PREFERENCE_COOLDOWN' });
      return true;
    },
    Date, Math,
    console: {
      log: (...args) => logs.push(args),
      error: (...args) => logs.push(args)
    }
  }, { filename: 'government-confidence-post.js' });
  assert.equal(handlers.length, 5, 'No-store must be the first middleware');
  const res = {
    statusCode: 200, headers: {}, body: null,
    set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = { userId: 'synthetic-user', user: { id: 'synthetic-user', isAdmin: false }, body: { risposta: choice } };
  for (const handler of handlers) {
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
  assert.match(res.headers['cache-control'], /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)no-store(?:,|$)/);
  assert.equal(logs.flat().join(' ').includes('synthetic-private-'), false);
  return { res, sequence, released };
}

test('an active preference is atomically replaced after user lock and consent verification', async () => {
  const { res, sequence, released } = await request({ previous: 'No' });
  assert.equal(res.statusCode, 200);
  assert.equal(released, true);
  assert.equal(res.body.data.risposta, 'Sì');
  assert.deepEqual(sequence, [
    'CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'CURRENT', 'COOLDOWN',
    'DELETE', 'INSERT', 'RECORD', 'COMMIT', 'RELEASE'
  ]);
});

test('revocation beats a stale middleware approval, no vote or metadata written', async () => {
  const { res, sequence } = await request({ consent: false, previous: 'No' });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'POLITICAL_CONSENT_REQUIRED');
  assert.equal(res.body.consent_required, true);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'ROLLBACK', 'RELEASE']);
});

test('no-op path also verifies consent inside the locked transaction', async () => {
  const { res, sequence } = await request({ previous: 'Sì' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Consenso già aggiornato');
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'CURRENT', 'ROLLBACK', 'RELEASE']);
});

test('the user must exist before reading any sensitive choice', async () => {
  const { res, sequence } = await request({ exists: false });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'ROLLBACK', 'RELEASE']);
});

test('cooldown prevents deletion and returns a 409 without writing a replacement', async () => {
  const { res, sequence } = await request({ previous: 'No', cooldownFails: true });
  assert.equal(res.statusCode, 409);
  assert.deepEqual(sequence.slice(-3), ['COOLDOWN', 'ROLLBACK', 'RELEASE']);
});

test('failed INSERT rolls back on the same client, preserving previous preference', async () => {
  const { res, sequence, released } = await request({ previous: 'No', insertFails: true });
  assert.equal(res.statusCode, 500);
  assert.equal(released, true);
  assert.equal(sequence.includes('RECORD'), false);
  assert.equal(JSON.stringify(res.body).includes('synthetic-private-'), false);
  assert.deepEqual(sequence.slice(-3), ['INSERT', 'ROLLBACK', 'RELEASE']);
});

test('failed COMMIT triggers rollback on the acquired client', async () => {
  const { res, sequence, released } = await request({ commitFails: true });
  assert.equal(res.statusCode, 500);
  assert.equal(released, true);
  assert.deepEqual(sequence.slice(-4), ['RECORD', 'COMMIT', 'ROLLBACK', 'RELEASE']);
});

test('all allowed answers are accepted without exposing SQL or user IDs in logs', async () => {
  for (const answer of ['Sì', 'Non so', 'No']) {
    const { res } = await request({ choice: answer });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.risposta, answer);
  }
});

test('invalid inputs and failed authentication cannot open a transaction', async () => {
  for (const settings of [
    { choice: 42 }, { choice: '' }, { choice: 'Forse' },
    { choice: null }, { authenticated: false }
  ]) {
    const { res, sequence } = await request(settings);
    assert.ok([400, 401].includes(res.statusCode));
    assert.deepEqual(sequence, []);
  }
});

test('revocation erasure still covers government confidence decisions', () => {
  const consentService = fs.readFileSync(
    path.join(__dirname, '../services/politicalConsentService.js'), 'utf8'
  );
  assert.match(consentService, /'consenso_governo'/);
});
