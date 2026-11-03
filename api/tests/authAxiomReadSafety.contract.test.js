'use strict';
// Isolated execution of the real authentication and Admin Axiom code.
// No network, provider secrets, live database or production writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function load(source, dependencies, environment, messages) {
  const module = { exports: {} };
  const fakeConsole = {
    log: (...values) => messages.push(values.join(' ')),
    warn: (...values) => messages.push(values.join(' ')),
    error: (...values) => messages.push(values.join(' ')),
  };
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw Error('Unexpected dependency: ' + name);
      return dependencies[name];
    },
    process: { env: { NODE_ENV: 'production', ...environment } },
    console: fakeConsole,
  }, { filename: 'isolated-demos-source.js' });
  return module.exports;
}

function response() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function auth({ verify = () => ({ userId: 'synthetic-user' }), lookup = async () => null, redis = { isEnabled: () => false }, authTtl = 0 } = {}) {
  const messages = [];
  const pool = { query() { throw Error('Unexpected SQL in isolated auth test'); } };
  const source = read('api/middleware/auth.js');
  const instance = load(source, {
    '../utils/jwt': { verifyAccessToken: verify },
    '../config/database': { getPool: () => pool },
    '../services/redisCache': redis,
    '../config/cacheKeys': { keys: { authUser: id => 'synthetic:' + id }, ttl: { authUser: authTtl } },
    '../services/accountCapabilitiesService': { getAccountSubject: lookup },
  }, {}, messages);
  return { instance, messages };
}

test('auth HTTP 500 never returns or logs the underlying request exception', async () => {
  const { instance, messages } = auth();
  const res = response();
  await instance.verifyToken({
    get headers() { throw Error('SYNTHETIC_HEADER_PRIVATE_VALUE'); },
  }, res, () => { throw Error('unexpected next'); });
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Errore interno del server');
  assert.equal(Object.hasOwn(res.body, 'details'), false);
  assert.doesNotMatch(JSON.stringify(res.body) + messages.join(' '), /SYNTHETIC_HEADER_PRIVATE_VALUE/);
});

test('expired JWT is a 401 without logging its raw diagnostic or claims', async () => {
  const { instance, messages } = auth({
    verify: () => { throw Error('expired SYNTHETIC_JWT_SECRET'); },
  });
  const res = response();
  await instance.verifyToken({ headers: { authorization: 'Bearer synthetic' } }, res,
    () => { throw Error('unexpected next'); });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Token scaduto');
  assert.doesNotMatch(JSON.stringify(res.body) + messages.join(' '), /SYNTHETIC_JWT_SECRET/);
});

test('SQL account lookup outage returns 503, not a misleading invalid-token 401', async () => {
  const { instance, messages } = auth({
    lookup: async () => { throw Error('SYNTHETIC_DATABASE_CREDENTIAL'); },
  });
  const res = response();
  await instance.verifyToken({ headers: { authorization: 'Bearer synthetic' } }, res,
    () => { throw Error('unexpected next'); });
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(JSON.stringify(res.body) + messages.join(' '), /SYNTHETIC_DATABASE_CREDENTIAL/);
});

test('Axiom Admin GETs reuse the shared read-only pool, hide audit email and never claim a verified migration', async () => {
  const routes = new Map();
  const sqls = [];
  const pool = {
    async query(sql) {
      sqls.push(String(sql));
      if (String(sql).includes('FROM centralized_logs')) return { rows: [{ count: '4' }] };
      if (String(sql).includes('information_schema.tables')) return { rows: [{ exists: false }] };
      if (String(sql).includes('FROM audit_logs')) return { rows: [{ count: '2' }] };
      throw Error('Unexpected SQL query');
    },
    end() { throw Error('Shared connection pool MUST NOT be closed'); },
  };
  const next = (_req, _res, done) => done();
  const express = {
    Router: () => ({
      get: (route, ...handlers) => routes.set('GET ' + route, handlers),
      post: (route, ...handlers) => routes.set('POST ' + route, handlers),
    }),
  };
  const source = read('api/routes/admin/axiom-migration.js');
  assert.doesNotMatch(source, /new Pool\s*\(|rejectUnauthorized:\s*false|pool\.end\s*\(/);
  const messages = [];
  load(source, {
    express,
    '../../middleware/auth': { verifyToken: next, requireAdmin: next, pool },
  }, { AXIOM_ORG_ID: 'synthetic-org', AXIOM_ENABLED: 'false' }, messages);

  async function call(method, route) {
    const res = response();
    const req = { userId: 'synthetic-admin', userRole: 'AD' };
    const handlers = routes.get(method + ' ' + route);
    assert.ok(handlers, 'Missing route ' + route);
    for (const handler of handlers) {
      if (handler.length === 3) {
        await new Promise(resolve => handler(req, res, resolve));
      } else {
        await handler(req, res);
      }
    }
    return res;
  }
  const migration = await call('GET', '/migration-stats');
  const status = await call('GET', '/status');
  const checkAuth = await call('GET', '/test-auth');
  assert.equal(migration.statusCode, 200);
  assert.equal(migration.body.migrationVerified, false);
  assert.equal(migration.body.stats.centralized_logs.totalInNeon, 4);
  assert.equal(migration.body.stats.audit_logs.totalInNeon, 2);
  assert.doesNotMatch(migration.body.message, /migrati con successo/i);
  assert.equal(status.body.stats.centralized_logs.total, 4);
  assert.equal(status.body.stats.audit_logs.total, 2);
  assert.equal(checkAuth.body.user.email, undefined);
  for (const result of [migration, status, checkAuth]) {
    assert.equal(result.headers['cache-control'], 'private, no-store, max-age=0');
  }
  const deletion = await call('POST', '/delete-migrated');
  const start = await call('POST', '/migrate');
  assert.equal(deletion.statusCode, 410);
  assert.equal(start.statusCode, 410);
  assert.equal(sqls.length, 6, 'only the six synthetic aggregate reads may execute');
});


function fixtureAccount(id, { admin = false, status = 'a', legacyRole } = {}) {
  return {
    id, status, legacyRole: legacyRole || (admin ? 'AD' : 'E'),
    capabilities: { accountType: 'PERSON', isAdmin: admin, isCandidate: false,
      isPolitician: false, isActivist: false },
  };
}

async function authenticateSynthetic(instance) {
  let called = 0;
  const req = { headers: { authorization: 'Bearer synthetic' } };
  const res = response();
  await instance.verifyToken(req, res, () => { called++; });
  return { req, res, called };
}

test('a Redis snapshot with former Admin privileges cannot authorize a revoked administrator', async () => {
  const writes = [];
  let reads = 0;
  let dbReads = 0;
  const redis = {
    isEnabled: () => true,
    async getJson() { reads++; return fixtureAccount('synthetic-user', { admin: true }); },
    async setJson(key, value) { writes.push({ key, value }); },
  };
  const { instance } = auth({
    authTtl: 15, redis,
    lookup: async () => { dbReads++; return fixtureAccount('synthetic-user'); },
  });
  const { req, called } = await authenticateSynthetic(instance);
  assert.equal(called, 1, 'valid JWT still reaches application');
  assert.equal(dbReads, 1, 'privileged cache MUST NOT suppress fresh account lookup');
  assert.equal(reads, 1);
  assert.equal(req.user.isAdmin, false);
  assert.equal(writes.length, 1, 'unprivileged replacement can be cached');
  const res = response();
  let granted = false;
  await instance.requireAdmin(req, res, () => { granted = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(granted, false);
});

test('current Admin always uses fresh account state and never writes Admin to Redis', async () => {
  let dbReads = 0;
  let writes = 0;
  const redis = {
    isEnabled: () => true,
    async getJson() { return null; },
    async setJson() { writes++; },
  };
  const { instance } = auth({
    authTtl: 15, redis,
    lookup: async () => { dbReads++; return fixtureAccount('synthetic-user', { admin: true }); },
  });
  for (let i = 0; i < 2; i++) {
    const { req, called } = await authenticateSynthetic(instance);
    assert.equal(called, 1);
    assert.equal(req.user.isAdmin, true);
    const res = response();
    let granted = false;
    await instance.requireAdmin(req, res, () => { granted = true; });
    assert.equal(granted, true);
  }
  assert.equal(dbReads, 2, 'each privileged request requires current database state');
  assert.equal(writes, 0, 'no Redis snapshot containing Admin privileges');
});

test('cached identity mismatch is rejected even for unprivileged cached profiles', async () => {
  let dbReads = 0;
  const redis = {
    isEnabled: () => true,
    async getJson() { return fixtureAccount('different-person'); },
    async setJson() {},
  };
  const { instance } = auth({
    authTtl: 15, redis,
    lookup: async () => { dbReads++; return fixtureAccount('synthetic-user'); },
  });
  const { req, called } = await authenticateSynthetic(instance);
  assert.equal(called, 1);
  assert.equal(dbReads, 1, 'wrong account ID cannot be reused from cache');
  assert.equal(req.user.id, 'synthetic-user');
});

test('normal unprivileged accounts retain Redis read-through and avoid unnecessary SQL', async () => {
  let dbReads = 0;
  let writes = 0;
  const redis = {
    isEnabled: () => true,
    async getJson() { return fixtureAccount('synthetic-user'); },
    async setJson() { writes++; },
  };
  const { instance } = auth({
    authTtl: 15, redis,
    lookup: async () => { dbReads++; return fixtureAccount('synthetic-user'); },
  });
  const { req, called } = await authenticateSynthetic(instance);
  assert.equal(called, 1);
  assert.equal(req.user.id, 'synthetic-user');
  assert.equal(req.user.isAdmin, false);
  assert.equal(dbReads, 0);
  assert.equal(writes, 0);
});

test('legacy AD role in a stale cache is not trusted even if capability flag is false', async () => {
  let dbReads = 0;
  const redis = {
    isEnabled: () => true,
    async getJson() { return fixtureAccount('synthetic-user', { legacyRole: 'AD' }); },
    async setJson() {},
  };
  const { instance } = auth({
    authTtl: 15, redis,
    lookup: async () => { dbReads++; return fixtureAccount('synthetic-user'); },
  });
  const { req, called } = await authenticateSynthetic(instance);
  assert.equal(called, 1);
  assert.equal(dbReads, 1);
  assert.equal(req.user.isAdmin, false);
});
