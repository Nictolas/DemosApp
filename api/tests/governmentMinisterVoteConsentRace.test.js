'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const full = fs.readFileSync(path.join(__dirname, '../routes/governo.js'), 'utf8');
const start = full.indexOf('// POST /api/governo/vota -');
const end = full.indexOf('// GET /api/governo - Lista membri del governo', start);
assert.ok(start >= 0 && end > start, 'Expected minister preference route');
const route = full.slice(start, end);

async function request({
  consent = true,
  exists = true,
  voti = { difesa: 'Alice One', esteri: 'Bob Two' },
  previous = {},
  failOn = null,
  cooldownOn = null,
  authenticated = true,
  admin = false
} = {}) {
  let handlers;
  const operations = [];
  const logs = [];
  let released = false;
  const client = {
    async query(sql, params = []) {
      const q = String(sql).replace(/\s+/g, ' ').trim();
      if (['BEGIN', 'ROLLBACK', 'COMMIT'].includes(q)) {
        operations.push(q);
        return { rows: [] };
      }
      if (q === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
        assert.deepEqual(Array.from(params), ['synthetic-user']);
        operations.push('LOCK');
        return { rows: exists ? [{ id: 'synthetic-user' }] : [] };
      }
      const ministerMatch = q.match(/^SELECT nome_display AS nome, timestamp FROM voti_(difesa|esteri) WHERE userid = \$1/);
      if (ministerMatch) {
        const ministry = ministerMatch[1];
        operations.push('READ:' + ministry);
        const value = previous[ministry];
        return { rows: value ? [{
          nome: value, timestamp: '2026-10-24T08:00:00Z'
        }] : [] };
      }
      const deleted = q.match(/^DELETE FROM voti_(difesa|esteri) WHERE userid = \$1$/);
      if (deleted) {
        operations.push('DELETE:' + deleted[1]);
        return { rowCount: 1, rows: [] };
      }
      const inserted = q.match(/^INSERT INTO voti_(difesa|esteri) /);
      if (inserted) {
        const ministry = inserted[1];
        operations.push('INSERT:' + ministry);
        assert.equal(params[0], 'synthetic-user');
        assert.equal(params[1], voti[ministry].trim().toLowerCase());
        if (failOn === ministry) throw Error('synthetic-sensitive-db-error');
        return { rowCount: 1, rows: [] };
      }
      throw Error('Unexpected synthetic SQL: ' + q);
    },
    release() { released = true; operations.push('RELEASE'); }
  };
  const pool = {
    connect: async () => { operations.push('CONNECT'); return client; },
    query: async () => { throw Error('Personal vote query outside transaction'); }
  };
  const pass = (_req, _res, next) => next();
  const router = { post(p, ...fns) {
    assert.equal(p, '/vota');
    handlers = fns;
  } };
  vm.runInNewContext(route, {
    router, pool, verifyToken: authenticated ? pass : (_req, res) => res.status(401).json({ success: false }),
    requireVerifiedCivicIdentity: pass, requirePoliticalConsent: pass,
    getPoliticalConsentState: async (db, userId) => {
      assert.equal(db, client);
      assert.equal(userId, 'synthetic-user');
      operations.push('CONSENT');
      return { exists, granted: consent };
    },
    assertPreferenceChangeAllowed: async (db, options) => {
      assert.equal(db, client);
      operations.push('COOLDOWN:' + options.scope.split(':')[1]);
      assert.equal(options.isAdmin, admin);
      if (cooldownOn === options.scope.split(':')[1]) {
        const err = Error('synthetic cooldown');
        err.code = 'PREFERENCE_COOLDOWN';
        throw err;
      }
    },
    recordPreferenceChange: async (db, options) => {
      assert.equal(db, client);
      operations.push('RECORD:' + options.scope.split(':')[1]);
    },
    sendCooldownError: (res, error) => {
      if (error?.code !== 'PREFERENCE_COOLDOWN') return false;
      res.status(409).json({ success: false, error: 'PREFERENCE_COOLDOWN' });
      return true;
    },
    console: { error: (...args) => logs.push(args) },
    Object
  }, { filename: 'minister-vote-handler.js' });
  assert.equal(handlers.length, 5, 'No-store middleware must run before authentication');
  const res = {
    statusCode: 200, headers: {}, body: null,
    set(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(payload) { this.body = payload; return this; }
  };
  const req = { userId: 'synthetic-user', user: { id: 'synthetic-user', isAdmin: admin }, body: { voti } };
  for (const handler of handlers) {
    let continued = false;
    await handler(req, res, () => { continued = true; });
    if (!continued) break;
  }
  assert.match(res.headers['cache-control'], /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)no-store(?:,|$)/);
  assert.equal(logs.flat().join(' ').includes('synthetic-sensitive-db-error'), false);
  return { res, operations, released, logs };
}

test('two ministry votes are saved in one transaction, both after lock and consent', async () => {
  const { res, operations, released } = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(released, true);
  assert.deepEqual(operations, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT',
    'READ:difesa', 'COOLDOWN:difesa', 'DELETE:difesa', 'INSERT:difesa', 'RECORD:difesa',
    'READ:esteri', 'COOLDOWN:esteri', 'DELETE:esteri', 'INSERT:esteri', 'RECORD:esteri',
    'COMMIT', 'RELEASE']);
});

test('revocation after preliminary middleware check refuses all votes, even empty batch', async () => {
  for (const voti of [{ difesa: 'Alice One' }, {}]) {
    const { res, operations } = await request({ consent: false, voti });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'POLITICAL_CONSENT_REQUIRED');
    assert.equal(res.body.consent_required, true);
    assert.deepEqual(operations, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'ROLLBACK', 'RELEASE']);
  }
});

test('account deletion fails closed and never reads personal choices', async () => {
  const { res, operations } = await request({ exists: false });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(operations, ['CONNECT', 'BEGIN', 'LOCK', 'ROLLBACK', 'RELEASE']);
});

test('all unchanged votes return idempotent no-op only after consent check', async () => {
  const { res, operations } = await request({
    voti: { difesa: 'Alice One', esteri: 'Bob Two' },
    previous: { difesa: 'Alice One', esteri: 'Bob Two' }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Preferenze già aggiornate');
  assert.deepEqual(operations, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT',
    'READ:difesa', 'READ:esteri', 'ROLLBACK', 'RELEASE']);
});

test('a second ministry failing cooldown rolls back earlier successful statements', async () => {
  const { res, operations, released } = await request({ cooldownOn: 'esteri' });
  assert.equal(res.statusCode, 409);
  assert.equal(released, true);
  assert.equal(operations.includes('COMMIT'), false);
  assert.deepEqual(operations.slice(-5), ['RECORD:difesa', 'READ:esteri', 'COOLDOWN:esteri', 'ROLLBACK', 'RELEASE']);
});

test('a second ministry INSERT failure rolls back all writes and redacts details', async () => {
  const { res, operations, logs, released } = await request({ failOn: 'esteri' });
  assert.equal(res.statusCode, 500);
  assert.equal(released, true);
  assert.equal(JSON.stringify(res.body).includes('synthetic-sensitive-db-error'), false);
  assert.equal(logs.flat().join(' ').includes('Alice One'), false);
  assert.equal(operations.includes('COMMIT'), false);
  assert.deepEqual(operations.slice(-3), ['INSERT:esteri', 'ROLLBACK', 'RELEASE']);
});

test('clearing a ministry is allowed without affecting other ministries', async () => {
  const { res, operations } = await request({
    voti: { difesa: null },
    previous: { difesa: 'Former Minister' }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(operations.includes('DELETE:difesa'), true);
  assert.equal(operations.includes('INSERT:difesa'), false);
  assert.equal(operations.some(x => x.includes('esteri')), false);
});

test('valid payload with unknown keys ignores them, without interpolating SQL', async () => {
  const { res, operations } = await request({
    voti: { difesa: 'Alice One', '__proto__.sql': 'DROP TABLE users' }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(operations.some(x => x.includes('DROP TABLE')), false);
  assert.equal(operations.some(x => x.includes('esteri')), false);
});

test('invalid scalar, array, object and too-long minister preferences fail before DB', async () => {
  for (const voti of [
    null, [], 'string', { difesa: { name: 'Alice' } },
    { difesa: 12 }, { difesa: 'x'.repeat(251) }
  ]) {
    const { res, operations } = await request({ voti });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(operations, []);
  }
});

test('unauthenticated requests cannot initiate a DB transaction and are no-store', async () => {
  const { res, operations } = await request({ authenticated: false });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(operations, []);
});

test('the revocation table allowlist includes the relevant ministry vote tables', () => {
  const svc = fs.readFileSync(path.join(__dirname, '../services/politicalConsentService.js'), 'utf8');
  for (const table of ['voti_primo_ministro','voti_difesa','voti_esteri','voti_ambiente_sicurezza_energetica','voti_sport']) {
    assert.ok(svc.includes("'" + table + "'"), table);
  }
});
