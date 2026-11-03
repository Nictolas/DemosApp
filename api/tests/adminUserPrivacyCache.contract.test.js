'use strict';
// Synthetic Admin user deletion and source-only log privacy regressions.
// No database, Redis, filesystem mutation or external provider is accessed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..', '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function prepare({ failAt = '', userId = 'synthetic-person' } = {}) {
  const effects = [];
  const log = [];
  let handler;
  const pool = {
    async query(sql) {
      effects.push('select');
      assert.match(sql, /SELECT id, email, status FROM users/);
      return { rows: [{ id: userId, email: 'private@example.invalid', status: 'a' }] };
    },
    async connect() {
      effects.push('connect');
      return {
        async query(sql) {
          const op = String(sql).trim();
          effects.push(op);
          if (failAt === op) throw Error('SYNTHETIC_SQL_PRIVATE_ERROR');
        },
        release() { effects.push('release'); },
      };
    },
  };
  const express = {
    Router: () => ({
      delete(route, ...handlers) {
        assert.equal(route, '/:userId');
        handler = handlers[handlers.length - 1];
      },
    }),
  };
  const middleware = { pool, verifyToken: (_req, _res, next) => next(),
    requireAdmin: (_req, _res, next) => next() };
  const module = { exports: {} };
  const dependencies = {
    express,
    '../../middleware/auth': middleware,
    '../../services/privacyErasureLedgerService': {
      EVENT_TYPES: { ACCOUNT_DELETED: 'ACCOUNT_DELETED' },
      async recordEvent(client, event) {
        effects.push('ledger');
        assert.equal(event.eventType, 'ACCOUNT_DELETED');
        assert.equal(event.userId, userId);
      },
      async enforceAccountDeletion(client, id) {
        effects.push('erase');
        assert.equal(id, userId);
        if (failAt === 'erase') throw Error('SYNTHETIC_ERASURE_FAILURE');
        return { erased: true };
      },
    },
    '../../services/redisCache': {
      async invalidateAuthUserCache(id) {
        effects.push('invalidate');
        assert.equal(id, userId);
      },
    },
  };
  vm.runInNewContext(read('api/routes/users/admin.js'), {
    module, exports: module.exports,
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw Error('Unmocked dependency ' + name);
      return dependencies[name];
    },
    console: { error: (...args) => log.push(args.join(' ')) },
  }, { filename: 'admin-user-delete-synthetic.js' });

  const response = () => ({
    statusCode: 200, headers: {}, body: null,
    set(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  return {
    effects, log,
    async call({ own = false } = {}) {
      const res = response();
      await handler({ userId: own ? userId : 'different-admin', params: { userId } }, res);
      return res;
    },
  };
}

test('Admin account erasure invalidates only after committed transaction', async () => {
  const fixture = prepare();
  const res = await fixture.call();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.headers['cache-control'], 'private, no-store, max-age=0');
  assert.deepEqual(fixture.effects, [
    'select', 'connect', 'BEGIN', 'ledger', 'erase', 'COMMIT',
    'invalidate', 'release',
  ]);
});

test('failed erasure rolls back and must not invalidate account cache', async () => {
  const fixture = prepare({ failAt: 'erase' });
  const res = await fixture.call();
  assert.equal(res.statusCode, 500);
  assert.equal(fixture.effects.includes('ROLLBACK'), true);
  assert.equal(fixture.effects.includes('COMMIT'), false);
  assert.equal(fixture.effects.includes('invalidate'), false);
  assert.equal(res.headers['cache-control'], 'private, no-store, max-age=0');
  assert.doesNotMatch(JSON.stringify(res.body) + fixture.log.join(' '), /SYNTHETIC_ERASURE_FAILURE/);
});

test('Admin cannot erase own account and no DB or cache is touched', async () => {
  const fixture = prepare();
  const res = await fixture.call({ own: true });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(fixture.effects, []);
});

test('Admin profile GET and PUT never emit identifying fields or unbounded raw errors', () => {
  const source = read('api/routes/users/search.js');
  assert.doesNotMatch(source, /console\.log\s*\(/, 'no Admin search/profile/PII debug logging');
  assert.doesNotMatch(source, /console\.(?:warn|error)\s*\([^;\n]*,\s*(?:error|e)\s*\)/,
    'no raw exception object logging');
  assert.doesNotMatch(source, /\b(?:error|details)\s*:\s*(?:error\.message|error\.stack)/,
    'no raw SQL failure returned to clients');
  assert.match(source,
    /router\.get\('\/:userId', verifyToken, requireAdmin, async \(req, res\) => \{\s*res\.set\('Cache-Control', 'private, no-store, max-age=0'\)/);
  assert.match(source,
    /router\.put\('\/:userId', verifyToken, requireAdmin, async \(req, res\) => \{\s*res\.set\('Cache-Control', 'private, no-store, max-age=0'\)/);
});

test('deletion route retains JWT + Admin gate and never returns a raw SQL exception', () => {
  const source = read('api/routes/users/admin.js');
  assert.match(source, /router\.delete\('\/:userId', verifyToken, requireAdmin/);
  assert.match(source, /await client\.query\('COMMIT'\);[\s\S]*?await invalidateAuthUserCache\(userId\)/);
  assert.doesNotMatch(source, /console\.error\([^\n]*,\s*error\)/);
});
