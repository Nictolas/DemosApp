'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const full = fs.readFileSync(path.join(__dirname, '../routes/grazia.js'), 'utf8');
const start = full.indexOf('// POST /api/grazia/vota -');
const end = full.indexOf('// POST /api/grazia/richiesta/:id/:action', start);
assert.ok(start >= 0 && end > start, 'Expected real Grazia voting route');
const route = full.slice(start, end);

async function request({
  granted = true, userExists = true, vote = ['Synthetic choice'], existing = null,
  authenticated = true, idType = 'uuid', userColumn = 'userid', timeColumn = 'timestamp',
  insertFails = false, cooldownFails = false, columnsPresent = true
} = {}) {
  const sequence = [], logs = [];
  let handlers = null;
  let released = false;
  const client = {
    async query(sql, params) {
      const statement = String(sql).replace(/\s+/g, ' ').trim();
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) {
        sequence.push(statement);
        return { rows: [] };
      }
      if (statement === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
        assert.deepEqual(Array.from(params), ['synthetic-user']);
        sequence.push('LOCK');
        return { rows: userExists ? [{ id: 'synthetic-user' }] : [] };
      }
      if (statement.startsWith('SELECT column_name, data_type FROM information_schema.columns')) {
        sequence.push('SCHEMA');
        return { rows: columnsPresent ? [
          { column_name: 'id', data_type: idType },
          { column_name: userColumn, data_type: 'uuid' },
          { column_name: timeColumn, data_type: 'timestamp with time zone' }
        ] : [] };
      }
      if (statement.startsWith('SELECT nome,')) {
        assert.ok(statement.includes('WHERE "' + userColumn + '" = $1'));
        sequence.push('READ_EXISTING');
        return { rows: existing === null ? [] : [{ nome: existing, changed_at: '2026-10-24T09:00:00Z' }] };
      }
      if (statement.startsWith('DELETE FROM voti_grazia')) {
        assert.ok(statement.includes('WHERE "' + userColumn + '" = $1'));
        sequence.push('DELETE');
        return { rowCount: existing === null ? 0 : 1 };
      }
      if (statement.startsWith('SELECT gen_random_uuid()')) {
        sequence.push('UUID');
        return { rows: [{ id: '00000000-0000-4000-8000-000000000281' }] };
      }
      if (statement.startsWith('INSERT INTO voti_grazia')) {
        assert.ok(statement.includes('"' + userColumn + '"'));
        assert.ok(statement.includes('"' + timeColumn + '"'));
        assert.equal(params[1], 'synthetic-user');
        assert.equal(params[2], vote[0].trim());
        sequence.push('INSERT');
        if (insertFails) throw new Error('synthetic-private-database-detail');
        return { rowCount: 1 };
      }
      throw new Error('Unexpected synthetic SQL: ' + statement);
    },
    release() { released = true; sequence.push('RELEASE'); }
  };
  const pool = {
    async connect() { sequence.push('CONNECT'); return client; },
    async query() { throw new Error('Sensitive statements must use locked client'); }
  };
  const pass = (_req, _res, next) => next();
  const verifyToken = authenticated ? pass : (_req, res) => res.status(401).json({ success: false });
  const router = { post(routeName, ...values) {
    assert.equal(routeName, '/vota');
    handlers = values;
  } };
  vm.runInNewContext(route, {
    router, pool, verifyToken,
    requireVerifiedCivicIdentity: pass,
    requirePoliticalConsent: pass,
    getPoliticalConsentState: async (db, id) => {
      assert.equal(db, client);
      assert.equal(id, 'synthetic-user');
      sequence.push('CONSENT');
      return { exists: userExists, granted };
    },
    assertPreferenceChangeAllowed: async (db, options) => {
      assert.equal(db, client);
      assert.equal(options.scope, 'grazia:preferenza');
      sequence.push('COOLDOWN');
      if (cooldownFails) {
        const error = new Error('Synthetic cooldown');
        error.code = 'PREFERENCE_COOLDOWN';
        throw error;
      }
    },
    recordPreferenceChange: async (db, options) => {
      assert.equal(db, client);
      assert.equal(options.scope, 'grazia:preferenza');
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
  }, { filename: 'synthetic-grazia-vote-handler.js' });
  assert.ok(handlers && handlers.length === 5, 'No-store middleware precedes authentication');
  const response = {
    statusCode: 200, headers: {}, body: null,
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = { userId: 'synthetic-user', user: { id: 'synthetic-user', isAdmin: false }, body: { voti: vote } };
  for (const handler of handlers) {
    let nextCalled = false;
    await handler(req, response, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
  assert.match(response.headers['cache-control'], /(?:^|,\s*)private(?:,|$)/);
  assert.match(response.headers['cache-control'], /(?:^|,\s*)no-store(?:,|$)/);
  assert.equal(logs.flat().join(' ').includes('synthetic-private-database-detail'), false);
  return { response, sequence, released };
}

test('active consent writes only after the user lock, consent and cooldown checks', async () => {
  const { response, sequence, released } = await request({ existing: 'Old synthetic choice' });
  assert.equal(response.statusCode, 200);
  assert.equal(released, true);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'SCHEMA', 'READ_EXISTING',
    'COOLDOWN', 'DELETE', 'UUID', 'INSERT', 'RECORD', 'COMMIT', 'RELEASE']);
});

test('revocation blocks stale middleware-authorized requests, including no-op attempts', async () => {
  for (const vote of [['Synthetic choice'], []]) {
    const { response, sequence } = await request({ granted: false, existing: 'Synthetic choice', vote });
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, 'POLITICAL_CONSENT_REQUIRED');
    assert.equal(response.body.consent_required, true);
    assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'ROLLBACK', 'RELEASE']);
  }
});

test('missing users fail closed before reading or writing political records', async () => {
  const { response, sequence } = await request({ userExists: false });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'ROLLBACK', 'RELEASE']);
});

test('unchanged preference returns without a new write, after locked consent check', async () => {
  const { response, sequence } = await request({ existing: 'Synthetic choice' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'SCHEMA', 'READ_EXISTING', 'ROLLBACK', 'RELEASE']);
});

test('empty choice removes an existing vote atomically and respects cooldown', async () => {
  const { response, sequence } = await request({ existing: 'Old synthetic choice', vote: [] });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'SCHEMA', 'READ_EXISTING',
    'COOLDOWN', 'DELETE', 'RECORD', 'COMMIT', 'RELEASE']);
});

test('failed insert rolls back and hides internal error details', async () => {
  const { response, sequence, released } = await request({ existing: 'Old synthetic choice', insertFails: true });
  assert.equal(response.statusCode, 500);
  assert.equal(released, true);
  assert.equal(JSON.stringify(response.body).includes('synthetic-private-database-detail'), false);
  assert.deepEqual(sequence.slice(-3), ['INSERT', 'ROLLBACK', 'RELEASE']);
  assert.equal(sequence.includes('RECORD'), false);
});

test('cooldown error rolls back before deleting a vote', async () => {
  const { response, sequence } = await request({ existing: 'Old synthetic choice', cooldownFails: true });
  assert.equal(response.statusCode, 409);
  assert.deepEqual(sequence.slice(-3), ['COOLDOWN', 'ROLLBACK', 'RELEASE']);
});

test('legacy userId and data_voto columns and text id type remain supported', async () => {
  const { response, sequence } = await request({ userColumn: 'userId', timeColumn: 'data_voto', idType: 'text' });
  assert.equal(response.statusCode, 200);
  assert.equal(sequence.includes('UUID'), false);
  assert.equal(sequence.includes('INSERT'), true);
});

test('unsupported schema fails closed, no insert or SQL response leak', async () => {
  const { response, sequence } = await request({ columnsPresent: false });
  assert.equal(response.statusCode, 500);
  assert.equal(sequence.includes('INSERT'), false);
  assert.deepEqual(sequence.slice(-2), ['ROLLBACK', 'RELEASE']);
});

test('invalid payload and unauthenticated request do not open database transaction', async () => {
  for (const options of [
    { vote: 'not-an-array' },
    { vote: ['one', 'two'] },
    { vote: [null] },
    { vote: ['   '] },
    { authenticated: false }
  ]) {
    const { response, sequence } = await request(options);
    assert.ok([400, 401].includes(response.statusCode));
    assert.deepEqual(sequence, []);
  }
});

test('consent revocation cleanup covers Grazia preference table', () => {
  const service = fs.readFileSync(path.join(__dirname, '../services/politicalConsentService.js'), 'utf8');
  assert.match(service, /'voti_grazia'/);
});
