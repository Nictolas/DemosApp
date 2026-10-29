'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/amnistia.js'), 'utf8');
const begin = source.indexOf('// POST /api/amnistia/vota - Vota per amnistia');
const end = source.indexOf('// DELETE /api/amnistia/vota - Rimuovi voto per amnistia', begin);
assert.ok(begin >= 0 && end > begin, 'Expected real amnesty vote handler');
const block = source.slice(begin, end);

async function request({ granted = true, userExists = true, existing = null, writeFails = false } = {}) {
  const sequence = [];
  let handler;
  let released = false;
  const client = {
    async query(sql) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) {
        sequence.push(s);
        return { rows: [], rowCount: 0 };
      }
      if (s === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
        sequence.push('LOCK');
        return { rows: userExists ? [{ id: 'synthetic-user' }] : [] };
      }
      if (s.startsWith('SELECT id, legge FROM voti_amnistia')) {
        sequence.push('READ_EXISTING');
        return { rows: existing ? [{ id: 1, legge: existing }] : [] };
      }
      if (s.startsWith('DELETE FROM voti_amnistia')) {
        sequence.push('DELETE');
        return { rows: [], rowCount: existing ? 1 : 0 };
      }
      if (s.startsWith('INSERT INTO voti_amnistia')) {
        sequence.push('INSERT');
        if (writeFails) throw new Error('synthetic insert failure');
        return { rows: [], rowCount: 1 };
      }
      throw new Error('Unexpected synthetic query: ' + s);
    },
    release() { released = true; sequence.push('RELEASE'); }
  };
  const pool = {
    async query(sql) {
      assert.match(sql, /SELECT id FROM amnistia WHERE legge/);
      sequence.push('LOOKUP');
      return { rows: [{ id: 'synthetic-amnesty' }] };
    },
    async connect() { sequence.push('CONNECT'); return client; }
  };
  const passthrough = (_req, _res, next) => next();
  const router = { post(route, ...handlers) {
    assert.equal(route, '/vota');
    handler = handlers[handlers.length - 1];
  } };
  vm.runInNewContext(block, {
    router,
    verifyToken: passthrough,
    requireVerifiedCivicIdentity: passthrough,
    requirePoliticalConsent: passthrough,
    validateInput: () => passthrough,
    pool,
    getPoliticalConsentState: async (db, id) => {
      assert.equal(db, client);
      assert.equal(id, 'synthetic-user');
      sequence.push('CONSENT');
      return { exists: true, granted };
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
    console: { log() {}, error() {} }
  }, { filename: 'routes/amnistia.js' });
  assert.equal(typeof handler, 'function');
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await handler({ body: { legge: 'synthetic-law' }, userId: 'synthetic-user', user: { id: 'synthetic-user' } }, res);
  assert.equal(released, true, 'transaction client must be released');
  return { res, sequence };
}

test('revoked consent after lock denies write and rolls back', async () => {
  const { res, sequence } = await request({ granted: false, existing: 'previous-law' });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'POLITICAL_CONSENT_REQUIRED');
  assert.equal(res.body.consent_required, true);
  assert.deepEqual(sequence, ['LOOKUP', 'CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'ROLLBACK', 'RELEASE']);
});

test('active consent replaces preference atomically only after lock and consent', async () => {
  const { res, sequence } = await request({ existing: 'previous-law' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(sequence, ['LOOKUP', 'CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'READ_EXISTING', 'COOLDOWN', 'DELETE', 'INSERT', 'RECORD', 'COMMIT', 'RELEASE']);
});

test('already-selected preference is not rewritten after consent recheck', async () => {
  const { res, sequence } = await request({ existing: 'synthetic-law' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(sequence, ['LOOKUP', 'CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'READ_EXISTING', 'ROLLBACK', 'RELEASE']);
});

test('failed insertion rolls back the replacement and does not record cooldown', async () => {
  const { res, sequence } = await request({ existing: 'previous-law', writeFails: true });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(sequence, ['LOOKUP', 'CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'READ_EXISTING', 'COOLDOWN', 'DELETE', 'INSERT', 'ROLLBACK', 'RELEASE']);
});

test('missing user cannot write after acquiring the lock', async () => {
  const { res, sequence } = await request({ userExists: false });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(sequence, ['LOOKUP', 'CONNECT', 'BEGIN', 'LOCK', 'ROLLBACK', 'RELEASE']);
});

test('revocation cleanup covers amnesty votes', () => {
  const consentService = fs.readFileSync(path.join(__dirname, '../services/politicalConsentService.js'), 'utf8');
  assert.match(consentService, /'voti_amnistia'/);
});
