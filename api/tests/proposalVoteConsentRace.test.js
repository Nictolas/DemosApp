'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/opinioni-proposte.js'), 'utf8');
const helperStart = source.indexOf('async function assertVotiTableExists(');
const helperEnd = source.indexOf('// GET /api/opinioni-proposte/test-voto', helperStart);
const start = source.indexOf('// POST /api/opinioni-proposte/:id/vota -');
const end = source.indexOf('// DELETE /api/opinioni-proposte/:id/vota', start);
assert.ok(helperStart > 0 && helperEnd > helperStart && start > 0 && end > start);
const code = source.slice(helperStart, helperEnd) + source.slice(start, end);

async function request({
  granted = true, exists = true, voteExists = false, schemaExists = true,
  candidateExists = true, legacyCandidate = false, writeFails = false,
  authenticated = true, id = 'synthetic-proposal'
} = {}) {
  const sequence = [], logged = [];
  let handlers;
  let released = false;
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
      if (q.includes("to_regclass('public.voti_opinioni_proposte')")) {
        sequence.push('SCHEMA');
        return { rows: [{ relation_name: schemaExists ? 'voti_opinioni_proposte' : null }] };
      }
      if (q === 'SELECT id FROM opinioni_proposte WHERE id = $1') {
        sequence.push('FIND_PROPOSAL');
        return { rows: candidateExists && !legacyCandidate ? [{ id }] : [] };
      }
      if (q.startsWith('SELECT id FROM opinioni_domande')) {
        sequence.push('FIND_LEGACY');
        return { rows: legacyCandidate && candidateExists ? [{ id }] : [] };
      }
      if (q.startsWith('INSERT INTO voti_opinioni_proposte')) {
        assert.deepEqual(Array.from(params), ['synthetic-user', id]);
        assert.match(q, /ON CONFLICT \(utente_id, opinione_id\) DO NOTHING/);
        sequence.push('INSERT');
        if (writeFails) throw Error('synthetic-personal-SQL-details');
        return { rowCount: voteExists ? 0 : 1, rows: [] };
      }
      throw Error('Unexpected SQL: ' + q);
    },
    release() { released = true; sequence.push('RELEASE'); }
  };
  const pool = {
    async connect() { sequence.push('CONNECT'); return client; },
    async query() { throw Error('Personal writes must not use an uncoordinated pool query'); }
  };
  const passthrough = (_req, _res, next) => next();
  const verifyToken = authenticated ? passthrough : (_req, res) => res.status(401).json({ success: false });
  const router = { post(routeName, ...fns) {
    assert.equal(routeName, '/:id/vota');
    handlers = fns;
  } };
  vm.runInNewContext(code, {
    pool, router, verifyToken,
    requireVerifiedCivicIdentity: passthrough,
    requirePoliticalConsent: passthrough,
    getPoliticalConsentState: async (db, userId) => {
      assert.equal(db, client);
      assert.equal(userId, 'synthetic-user');
      sequence.push('CONSENT');
      return { exists, granted };
    },
    console: { log: (...a) => logged.push(a), error: (...a) => logged.push(a) }
  }, { filename: 'synthetic-proposal-vote.js' });
  assert.equal(handlers.length, 5);
  const res = {
    statusCode: 200, headers: {}, body: null,
    set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  const req = {
    userId: 'synthetic-user', user: { id: 'synthetic-user' }, params: { id }
  };
  for (const handler of handlers) {
    let nextInvoked = false;
    await handler(req, res, () => { nextInvoked = true; });
    if (!nextInvoked) break;
  }
  assert.match(res.headers['cache-control'], /(?:^|,\s*)private(?:,|$)/);
  assert.match(res.headers['cache-control'], /(?:^|,\s*)no-store(?:,|$)/);
  assert.equal(logged.flat().join(' ').includes('synthetic-personal-SQL-details'), false);
  return { res, sequence, released };
}

test('active consent inserts only after user lock, consent check and schema check', async () => {
  const { res, sequence, released } = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(released, true);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'SCHEMA', 'FIND_PROPOSAL', 'INSERT', 'COMMIT', 'RELEASE']);
});

test('revocation wins user lock: post-check returns 403, no proposal read or write', async () => {
  const { res, sequence, released } = await request({ granted: false });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'POLITICAL_CONSENT_REQUIRED');
  assert.equal(res.body.consent_required, true);
  assert.equal(released, true);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'CONSENT', 'ROLLBACK', 'RELEASE']);
});

test('missing account fails closed after lock and before opinion lookup', async () => {
  const { res, sequence } = await request({ exists: false });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(sequence, ['CONNECT', 'BEGIN', 'LOCK', 'ROLLBACK', 'RELEASE']);
});

test('duplicate vote remains idempotent inside transaction', async () => {
  const { res, sequence } = await request({ voteExists: true });
  assert.equal(res.statusCode, 200);
  assert.equal(sequence.includes('INSERT'), true);
  assert.deepEqual(sequence.slice(-3), ['INSERT', 'COMMIT', 'RELEASE']);
});

test('legacy opinions in da approvare remain votable', async () => {
  const { res, sequence } = await request({ legacyCandidate: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(sequence.slice(-5), ['FIND_PROPOSAL', 'FIND_LEGACY', 'INSERT', 'COMMIT', 'RELEASE']);
});

test('invalid or absent proposal returns 404 and rolls back', async () => {
  const { res, sequence } = await request({ candidateExists: false });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(sequence.slice(-3), ['FIND_LEGACY', 'ROLLBACK', 'RELEASE']);
});

test('missing migration fails closed before vote insertion, without exposing internals', async () => {
  const { res, sequence } = await request({ schemaExists: false });
  assert.equal(res.statusCode, 500);
  assert.equal(sequence.includes('INSERT'), false);
  assert.deepEqual(sequence.slice(-3), ['SCHEMA', 'ROLLBACK', 'RELEASE']);
});

test('failed vote insertion rolls back and redacts SQL details from logs and HTTP', async () => {
  const { res, sequence, released } = await request({ writeFails: true });
  assert.equal(res.statusCode, 500);
  assert.equal(released, true);
  assert.equal(JSON.stringify(res.body).includes('synthetic-personal-SQL-details'), false);
  assert.deepEqual(sequence.slice(-3), ['INSERT', 'ROLLBACK', 'RELEASE']);
});

test('auth failures and malformed path IDs do not acquire a database client', async () => {
  for (const x of [{ authenticated: false }, { id: '' }, { id: ' ' }]) {
    const { res, sequence } = await request(x);
    assert.ok([400, 401].includes(res.statusCode));
    assert.deepEqual(sequence, []);
  }
});

test('revocation erasure includes proposal voting table', () => {
  const data = fs.readFileSync(path.join(__dirname, '../services/politicalConsentService.js'), 'utf8');
  assert.match(data, /'voti_opinioni_proposte'/);
});
