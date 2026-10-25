'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const full = fs.readFileSync(path.join(__dirname, '../routes/capo-stato.js'), 'utf8');
const start = full.indexOf('// POST /api/capo-stato/vota -');
const end = full.indexOf('// POST /api/capo-stato - endpoint legacy', start);
assert.ok(start >= 0 && end > start, 'Head of State voting route must exist');
const source = full.slice(start, end);

async function request({
  consent = true, exists = true, choice = ['Synthetic candidate'],
  existing = null, validAuth = true, idType = 'uuid',
  userColumn = 'userid', insertFails = false, cooldownFails = false
} = {}) {
  const sequence = [], logs = [];
  let handlers, released = false;
  const client = {
    async query(sql, params) {
      const q = String(sql).replace(/\s+/g, ' ').trim();
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q)) {
        sequence.push(q);
        return { rows: [] };
      }
      if (q === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
        assert.deepEqual(Array.from(params), ['synthetic-user']);
        sequence.push('LOCK');
        return { rows: exists ? [{ id: 'synthetic-user' }] : [] };
      }
      if (q.startsWith('SELECT column_name, data_type FROM information_schema.columns')) {
        sequence.push('SCHEMA');
        return { rows: [
          { column_name: 'id', data_type: idType },
          { column_name: userColumn, data_type: 'uuid' }
        ] };
      }
      if (q.startsWith('SELECT nome, timestamp FROM voti_capo_stato')) {
        assert.ok(q.includes('WHERE "' + userColumn + '" = $1'));
        sequence.push('READ_EXISTING');
        return { rows: existing ? [{ nome: existing, timestamp: '2026-10-24T10:00:00Z' }] : [] };
      }
      if (q.startsWith('DELETE FROM voti_capo_stato')) {
        assert.ok(q.includes('WHERE "' + userColumn + '" = $1'));
        sequence.push('DELETE');
        return { rowCount: existing ? 1 : 0, rows: [] };
      }
      if (q.startsWith('SELECT gen_random_uuid()')) {
        sequence.push('UUID');
        return { rows: [{ id: '00000000-0000-4000-8000-000000000280' }] };
      }
      if (q.startsWith('INSERT INTO voti_capo_stato')) {
        assert.ok(q.includes('"' + userColumn + '"'));
        assert.equal(params[1], 'synthetic-user');
        assert.equal(params[2], choice[0]);
        sequence.push('INSERT');
        if (insertFails) throw Error('synthetic-private-SQL-detail');
        return { rowCount: 1, rows: [] };
      }
      throw Error('Unexpected query: ' + q);
    },
    release() { released = true; sequence.push('RELEASE'); }
  };
  const pool = {
    async connect() { sequence.push('CONNECT'); return client; },
    query() { throw Error('Writes or sensitive reads must not use pool.query'); }
  };
  const pass = (_req, _res, next) => next();
  const verifyToken = validAuth ? pass : (_req, res) => res.status(401).json({ success: false });
  const router = { post(route, ...list) {
    assert.equal(route, '/vota');
    handlers = list;
  } };
  vm.runInNewContext(source, {
    router, pool, verifyToken, requireVerifiedCivicIdentity: pass, requirePoliticalConsent: pass,
    getPoliticalConsentState: async (db, userId) => {
      assert.equal(db, client);
      assert.equal(userId, 'synthetic-user');
      sequence.push('CONSENT');
      return { exists, granted: consent };
    },
    isIneligibleCandidate: value => value === 'Ineligible',
    assertPreferenceChangeAllowed: async (db, opts) => {
      assert.equal(db, client);
      assert.equal(opts.userId, 'synthetic-user');
      sequence.push('COOLDOWN');
      if (cooldownFails) {
        const error = Error('cooldown');
        error.code = 'PREFERENCE_COOLDOWN';
        throw error;
      }
    },
    recordPreferenceChange: async db => {
      assert.equal(db, client);
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
      warn: (...args) => logs.push(args),
      error: (...args) => logs.push(args)
    }
  }, { filename: 'head-of-state-vote.js' });
  assert.ok(handlers?.length >= 5, 'No-store must execute before auth');
  const res = {
    statusCode: 200, headers: {}, body: null,
    set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = {
    userId: 'synthetic-user', user: { id: 'synthetic-user', isAdmin: false },
    body: { voti: choice }
  };
  for (const handler of handlers) {
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
  assert.match(res.headers['cache-control'] || '', /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'] || '', /(?:^|,\s*)no-store(?:,|$)/);
  assert.equal(logs.flat().join(' ').includes('synthetic-private-SQL-detail'), false);
  return { res, sequence, logs, released };
}

test('saved preference is after lock and consent and commits once on the acquired client', async () => {
  const { res, sequence, released } = await request({ existing: 'Other' });
  assert.equal(res.statusCode, 200);
  assert.equal(released, true);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'SCHEMA',
    'READ_EXISTING', 'COOLDOWN', 'DELETE', 'UUID', 'INSERT', 'RECORD', 'COMMIT', 'RELEASE']);
});

test('revoked consent blocks even a no-op preference without touching vote table', async () => {
  for (const choice of [['Synthetic candidate'], []]) {
    const { res, sequence, released } = await request({ consent: false, existing: 'Synthetic candidate', choice });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'POLITICAL_CONSENT_REQUIRED');
    assert.equal(res.body.consent_required, true);
    assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'ROLLBACK', 'RELEASE']);
    assert.equal(released, true);
  }
});

test('missing user cannot read or write political preferences', async () => {
  const { res, sequence } = await request({ exists: false });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'ROLLBACK', 'RELEASE']);
});

test('unchanged vote is not rewritten, but only after lock and consent recheck', async () => {
  const { res, sequence } = await request({ existing: 'Synthetic candidate' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'SCHEMA', 'READ_EXISTING', 'ROLLBACK', 'RELEASE']);
});

test('empty choice deletes an existing preference transactionally', async () => {
  const { res, sequence } = await request({ existing: 'Old candidate', choice: [] });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'SCHEMA',
    'READ_EXISTING', 'COOLDOWN', 'DELETE', 'RECORD', 'COMMIT', 'RELEASE']);
});

test('insert error rolls back, releases DB client, does not expose internal details', async () => {
  const { res, sequence, released } = await request({ existing: 'Old candidate', insertFails: true });
  assert.equal(res.statusCode, 500);
  assert.equal(released, true);
  assert.equal(JSON.stringify(res.body).includes('synthetic-private-SQL-detail'), false);
  assert.equal(sequence.includes('RECORD'), false);
  assert.deepEqual(sequence.slice(-3), ['INSERT', 'ROLLBACK', 'RELEASE']);
});

test('cooldown aborts transaction before deleting any vote', async () => {
  const { res, sequence } = await request({ existing: 'Old candidate', cooldownFails: true });
  assert.equal(res.statusCode, 409);
  assert.deepEqual(sequence.slice(-3), ['COOLDOWN', 'ROLLBACK', 'RELEASE']);
});

test('legacy text IDs and quoted mixed-case user column remain supported', async () => {
  const { res, sequence } = await request({ idType: 'text', userColumn: 'userId' });
  assert.equal(res.statusCode, 200);
  assert.equal(sequence.includes('UUID'), false);
  assert.ok(sequence.includes('INSERT'));
});

test('invalid input and missing authentication fail before opening a connection and remain no-store', async () => {
  for (const options of [
    { choice: 'Synthetic candidate' },
    { choice: ['Ineligible'] },
    { choice: ['x', 'y'] },
    { choice: [null] },
    { validAuth: false }
  ]) {
    const { res, sequence } = await request(options);
    assert.ok([400, 401, 422].includes(res.statusCode));
    assert.deepEqual(sequence, []);
  }
});

test('revocation erasure still covers head of state ballots', () => {
  const service = fs.readFileSync(path.join(__dirname, '../services/politicalConsentService.js'), 'utf8');
  assert.match(service, /'voti_capo_stato'/);
});
