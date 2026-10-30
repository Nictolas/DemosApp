const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/auth/logout.js'), 'utf8');

function loadRoute(overrides = {}) {
  const logs = [];
  let handler;
  const fakeRouter = { post(route, fn) {
    assert.equal(route, '/logout');
    handler = fn;
  } };
  const dependencies = {
    express: { Router: () => fakeRouter },
    '../../utils/jwt': {
      verifyAccessToken: () => ({ userId: 'synthetic-user', sid: 'synthetic-session' }),
      verifyRefreshToken: () => ({ userId: 'synthetic-user', sid: 'synthetic-session' }),
    },
    '../../services/sessionService': { revokeRefreshSession: async () => {} },
    '../../services/accessRevocationService': {
      MAX_ACCESS_TOKEN_TTL_SECONDS: 86400,
      revokeAccessSession: async () => {},
      revokeDecodedAccessToken: async () => {},
    },
    ...overrides,
  };
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), 'unexpected dependency ' + name);
      return dependencies[name];
    },
    console: {
      warn: (...args) => logs.push(['warn', ...args]),
      error: (...args) => logs.push(['error', ...args]),
    },
  };
  vm.runInNewContext(source, sandbox, { filename: 'logout.js' });
  return { handler, logs };
}

async function request(handler) {
  const result = { statusCode: null, body: null };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
  };
  await handler({
    body: { refreshToken: 'synthetic-refresh-token' },
    headers: { authorization: 'Bearer synthetic-access-token' },
    ip: '192.0.2.1',
    get: () => 'synthetic-user-agent',
  }, res);
  return result;
}

test('logout never writes raw database exception details to operational logs', async () => {
  const marker = 'SENSITIVE_MARKER_TOKEN_SQL_USER';
  const { handler, logs } = loadRoute({
    '../../services/sessionService': {
      revokeRefreshSession: async () => { throw new Error(marker); },
    },
  });
  const response = await request(handler);
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
  assert.equal(logs.filter((entry) => entry[0] === 'error').length, 1);
  assert.ok(!JSON.stringify(logs).includes(marker), 'raw error leaked into logs');
  assert.ok(!JSON.stringify(response).includes(marker), 'raw error leaked into HTTP response');
});

test('logout still returns 503 when the access revocation store is unavailable', async () => {
  const unavailable = Object.assign(new Error('SENSITIVE_MARKER_STORE'), {
    code: 'ACCESS_REVOCATION_STORE_UNAVAILABLE',
  });
  const { handler, logs } = loadRoute({
    '../../services/accessRevocationService': {
      MAX_ACCESS_TOKEN_TTL_SECONDS: 86400,
      revokeAccessSession: async () => { throw unavailable; },
      revokeDecodedAccessToken: async () => {},
    },
  });
  const response = await request(handler);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
  assert.ok(!JSON.stringify(logs).includes('SENSITIVE_MARKER_STORE'));
});

test('successful logout preserves refresh and access session revocation', async () => {
  const called = [];
  const { handler, logs } = loadRoute({
    '../../services/sessionService': {
      revokeRefreshSession: async ({ sessionId }) => { called.push(['refresh', sessionId]); },
    },
    '../../services/accessRevocationService': {
      MAX_ACCESS_TOKEN_TTL_SECONDS: 86400,
      revokeAccessSession: async (sid, ttl) => { called.push(['access-session', sid, ttl]); },
      revokeDecodedAccessToken: async () => { called.push(['access-token']); },
    },
  });
  const response = await request(handler);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(called, [
    ['refresh', 'synthetic-session'],
    ['access-token'],
    ['access-session', 'synthetic-session', 86400],
  ]);
  assert.equal(logs.length, 0);
});
