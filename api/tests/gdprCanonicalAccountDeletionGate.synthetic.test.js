'use strict';
// Runs actual route source in a VM with synthetic Express/DB/Redis stubs.
// No real PostgreSQL, Redis, Axiom, network or persistent user data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function res() {
  return {
    statusCode: 200, headers: {}, body: null,
    set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(v) { this.statusCode = v; return this; },
    json(v) { this.body = v; return this; },
  };
}

function loadRoute(source, dependencies, logs) {
  const routes = { use: [], delete: new Map() };
  const express = {
    Router: () => ({
      use(...args) { routes.use.push(args); },
      get() {}, post() {}, put() {},
      delete(route, ...handlers) { routes.delete.set(route, handlers); },
    }),
  };
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require(name) {
      if (name === 'express') return express;
      if (!Object.hasOwn(dependencies, name)) throw Error('Unexpected dependency: ' + name);
      return dependencies[name];
    },
    console: { log() {}, warn() {}, error: (...args) => logs.push(args.join(' ')) },
    process: { env: { AXIOM_ENABLED: 'true' } },
  }, { filename: 'isolated-account-delete.js' });
  return routes;
}

function canonical({ fail = null, hasPassword = false } = {}) {
  const operations = [], logs = [];
  let released = 0;
  const client = {
    async query(sql) {
      const statement = String(sql).trim();
      const label = statement.startsWith('SELECT password_hash') ? 'SELECT' : statement;
      operations.push(label);
      if (fail === label) throw Error('SYNTHETIC_PRIVATE_DB_ERROR');
      if (label === 'SELECT') return { rows: [{ password_hash: hasPassword ? 'fake-hash' : null }] };
      return { rows: [] };
    },
    release() { released++; },
  };
  const pool = {
    async connect() {
      operations.push('CONNECT');
      if (fail === 'CONNECT') throw Error('SYNTHETIC_DB_CONNECT_SECRET');
      return client;
    },
    query() { throw Error('pool.query forbidden in canonical erasure'); },
  };
  const source = read('api/routes/user/delete-account.js');
  const routes = loadRoute(source, {
    '../../middleware/auth': { verifyToken: (_req, _res, next) => next() },
    '../../services/auditService': {
      async logAction(action) {
        operations.push('AUDIT_' + action.action);
      },
    },
    '../../config/database': { getPool: () => pool },
    bcryptjs: { async compare(password, hash) { return password === 'valid-secret' && hash === 'fake-hash'; } },
    '../../services/privacyErasureLedgerService': {
      EVENT_TYPES: { ACCOUNT_DELETED: 'ACCOUNT_DELETED' },
      async recordEvent(_client, event) {
        operations.push('LEDGER');
        assert.equal(event.eventType, 'ACCOUNT_DELETED');
      },
      async enforceAccountDeletion() {
        operations.push('ERASE');
        if (fail === 'ERASE') throw Error('SYNTHETIC_PRIVATE_ERASURE_ERROR');
        return { rowsDeleted: 1 };
      },
      async deleteByAnyColumn() { throw Error('Unexpected local audit deletion'); },
    },
    '../../services/redisCache': {
      async invalidateAuthUserCache(id) {
        assert.equal(id, 'synthetic-user');
        operations.push('INVALIDATE');
        if (fail === 'INVALIDATE') throw Error('SYNTHETIC_REDIS_PRIVATE_ERROR');
      },
    },
  }, logs);
  const handler = routes.delete.get('/')?.at(-1);
  assert.equal(typeof handler, 'function');
  return {
    operations, logs, released: () => released,
    async invoke({ confirmation = 'CANCELLA', password } = {}) {
      const response = res();
      const request = {
        user: { id: 'synthetic-user' },
        body: { confirmText: confirmation, password },
      };
      await handler(request, response);
      return response;
    },
  };
}

test('legacy DELETE /api/user/account is fail-closed before any SQL or audit', async () => {
  const log = [], sideEffects = [];
  const auth = (_req, _res, next) => next();
  const routes = loadRoute(read('api/routes/user/gdpr-rights.js'), {
    '../../middleware/auth': {
      verifyToken: auth,
      pool: { query() { sideEffects.push('SQL'); throw Error('UNEXPECTED_DB_READ'); } },
    },
    '../../middleware/validation': { validateInput: () => (_req, _res, next) => next() },
    '../../services/auditService': {
      logAction() { sideEffects.push('AUDIT'); throw Error('UNEXPECTED_AUDIT'); },
    },
    '../../utils/emailCrypto': { decrypt: () => null },
    crypto: {},
  }, log);
  assert.ok(routes.use.some(args => args.includes(auth)), 'shared authentication required');
  const handler = routes.delete.get('/account')?.at(-1);
  assert.equal(typeof handler, 'function');
  const response = res();
  await handler({ userId: 'synthetic-user', body: { confirmation: 'CONFERMO_CANCELLAZIONE_ACCOUNT' } }, response);
  assert.equal(response.statusCode, 410);
  assert.equal(response.headers['cache-control'], 'private, no-store, max-age=0');
  assert.equal(response.body.canonicalPath, '/api/user/delete-account');
  assert.deepEqual(sideEffects, [], 'no legacy destructive effects');
  assert.doesNotMatch(JSON.stringify(response.body) + log.join(' '), /synthetic-user/);
});

test('canonical erasure uses a single client and invalidates only after COMMIT', async () => {
  const fx = canonical();
  const response = await fx.invoke();
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.ok(fx.operations.indexOf('COMMIT') < fx.operations.indexOf('INVALIDATE'));
  assert.ok(fx.operations.includes('LEDGER'));
  assert.ok(fx.operations.includes('ERASE'));
  assert.equal(fx.operations.filter(op => op === 'CONNECT').length, 1);
  assert.equal(fx.released(), 1);
});

test('failed ledger erasure rolls back and never invalidates Redis', async () => {
  const fx = canonical({ fail: 'ERASE' });
  const response = await fx.invoke();
  assert.equal(response.statusCode, 500);
  assert.ok(fx.operations.includes('ROLLBACK'));
  assert.ok(!fx.operations.includes('COMMIT'));
  assert.ok(!fx.operations.includes('INVALIDATE'));
  assert.equal(fx.released(), 1);
  assert.doesNotMatch(JSON.stringify(response.body) + fx.logs.join(' '), /SYNTHETIC_PRIVATE_ERASURE_ERROR/);
});

test('Redis outage after COMMIT cannot turn completed erasure into HTTP 500', async () => {
  const fx = canonical({ fail: 'INVALIDATE' });
  const response = await fx.invoke();
  assert.equal(response.statusCode, 200);
  assert.ok(fx.operations.includes('COMMIT'));
  assert.ok(!fx.operations.includes('ROLLBACK'));
  assert.equal(fx.released(), 1);
  assert.doesNotMatch(JSON.stringify(response.body) + fx.logs.join(' '), /SYNTHETIC_REDIS_PRIVATE_ERROR/);
});

test('database connect failure is handled without unhandled rejection or client release', async () => {
  const fx = canonical({ fail: 'CONNECT' });
  const response = await fx.invoke();
  assert.equal(response.statusCode, 500);
  assert.equal(fx.released(), 0, 'cannot release a client that was never acquired');
  assert.ok(!fx.operations.includes('COMMIT'));
  assert.ok(!fx.operations.includes('ERASE'));
  assert.doesNotMatch(JSON.stringify(response.body) + fx.logs.join(' '), /SYNTHETIC_DB_CONNECT_SECRET/);
});

test('password-protected accounts cannot be deleted without a valid password', async () => {
  const fx = canonical({ hasPassword: true });
  const response = await fx.invoke();
  assert.equal(response.statusCode, 400);
  assert.ok(fx.operations.includes('ROLLBACK'));
  assert.ok(!fx.operations.includes('ERASE'));
  assert.ok(!fx.operations.includes('COMMIT'));
  assert.ok(!fx.operations.includes('INVALIDATE'));
  assert.equal(fx.released(), 1);
});
