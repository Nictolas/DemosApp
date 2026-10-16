const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(64);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'b'.repeat(64);

const { securityMiddleware, _test } = require('../middleware/security');
const {
  generateAccessToken,
  generateRefreshToken,
  generateOAuthPendingToken
} = require('../utils/jwt');

function makeReq(path, token) {
  return {
    originalUrl: path,
    url: path,
    method: 'GET',
    ip: '127.0.0.1',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: {},
    query: {},
    params: {},
    get(name) {
      const key = String(name).toLowerCase();
      if (key === 'content-length') return '0';
      if (key === 'user-agent') return 'DEMOS-security-test';
      return undefined;
    }
  };
}

function makeRes() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

async function withHttpSecurityApp(run) {
  const app = express();
  app.use(securityMiddleware);

  app.get('/api/smoke/ok', (_req, res) => {
    res.status(200).json({ success: true });
  });

  app.get('/api/smoke/client-error', (_req, res) => {
    res.status(400).json({ success: false, error: 'Errore specifico client', field: 'name' });
  });

  app.get('/api/smoke/server-error', (_req, res) => {
    res.status(500).json({
      success: false,
      error: 'duplicate key value violates unique constraint users_email_key',
      details: 'sensitive database detail',
      stack: 'secret stack',
      requestId: 'req-http-smoke-1'
    });
  });

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test('production log redaction removes credentials and identity claims', () => {
  const clean = _test.redactForLogs({
    authorization: 'Bearer secret-token',
    cookie: 'sid=secret',
    nested: {
      email: 'person@example.test',
      userId: 'user-123',
      safe: 'kept'
    },
    message: 'Authorization was Bearer abc.def.ghi'
  });

  assert.equal(clean.authorization, '[REDACTED]');
  assert.equal(clean.cookie, '[REDACTED]');
  assert.equal(clean.nested.email, '[REDACTED]');
  assert.equal(clean.nested.userId, '[REDACTED]');
  assert.equal(clean.nested.safe, 'kept');
  assert.equal(clean.message.includes('abc.def.ghi'), false);
});

test('production 5xx responses are reduced to a generic public contract', () => {
  const req = makeReq('/api/example');
  const res = makeRes();
  let nextCalled = false;

  securityMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  res.status(500).json({
    success: false,
    error: 'duplicate key value violates unique constraint users_email_key',
    details: 'sensitive database detail',
    code: '23505',
    stack: 'secret stack',
    requestId: 'req-safe-1'
  });

  assert.deepEqual(res.payload, {
    success: false,
    error: 'Errore interno del server',
    requestId: 'req-safe-1'
  });
});

test('production 4xx responses preserve the route-specific public contract', () => {
  const req = makeReq('/api/example');
  const res = makeRes();
  let nextCalled = false;

  securityMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  res.status(400).json({ success: false, error: 'Campo non valido', field: 'name' });
  assert.deepEqual(res.payload, { success: false, error: 'Campo non valido', field: 'name' });
});

test('non-auth API paths reject oauth_pending bearer tokens before legacy route verification', () => {
  const pending = generateOAuthPendingToken({
    provider: 'google',
    provider_sub: 'provider-user-1'
  });
  const req = makeReq('/api/governo/consenso', pending);
  const res = makeRes();
  let nextCalled = false;

  securityMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.error, 'Token non valido');
});

test('non-auth API paths reject refresh bearer tokens', () => {
  const refresh = generateRefreshToken({ userId: '00000000-0000-4000-8000-000000000002' });
  const req = makeReq('/api/governo/consenso', refresh);
  const res = makeRes();
  let nextCalled = false;

  securityMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.error, 'Token non valido');
});

test('non-auth API paths reject expired access bearer tokens', () => {
  const expired = jwt.sign({
    userId: '00000000-0000-4000-8000-000000000003',
    type: 'access',
    exp: Math.floor(Date.now() / 1000) - 60
  }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'demosapp',
    audience: 'demosapp-users'
  });

  const req = makeReq('/api/governo/consenso', expired);
  const res = makeRes();
  let nextCalled = false;

  securityMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.error, 'Token non valido');
});

test('valid access bearer tokens pass the canonical production gate', () => {
  const access = generateAccessToken({ userId: '00000000-0000-4000-8000-000000000001' });
  const req = makeReq('/api/governo/consenso', access);
  const res = makeRes();
  let nextCalled = false;

  securityMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('auth API paths remain available for their dedicated pending-token validation', () => {
  const pending = generateOAuthPendingToken({
    provider: 'google',
    provider_sub: 'provider-user-2'
  });
  const req = makeReq('/api/auth/oauth/complete-registration', pending);
  const res = makeRes();
  let nextCalled = false;

  securityMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('non-app validation harness bearer tokens are not interpreted as DEMOS access tokens', () => {
  const req = makeReq('/__security-phase2-validation/rt02/probe', 'synthetic-harness-token-not-a-jwt');
  const res = makeRes();
  let nextCalled = false;

  securityMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('attack-filter precedence remains deterministic before bearer rejection', () => {
  const req = makeReq('/api/governo/consenso', 'not-a-valid-jwt');
  req.query = { q: '1 OR 1=1' };
  const res = makeRes();
  let nextCalled = false;

  securityMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Input non valido');
});

test('HTTP smoke: valid access token reaches an API route', async () => {
  await withHttpSecurityApp(async (baseUrl) => {
    const access = generateAccessToken({ userId: '00000000-0000-4000-8000-000000000010' });
    const response = await fetch(`${baseUrl}/api/smoke/ok`, {
      headers: { Authorization: `Bearer ${access}` }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
  });
});

test('HTTP smoke: pending and refresh tokens cannot reach normal API routes', async () => {
  await withHttpSecurityApp(async (baseUrl) => {
    const pending = generateOAuthPendingToken({ provider: 'google', provider_sub: 'provider-user-http' });
    const refresh = generateRefreshToken({ userId: '00000000-0000-4000-8000-000000000011' });

    for (const token of [pending, refresh]) {
      const response = await fetch(`${baseUrl}/api/smoke/ok`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.equal(response.status, 401);
      const payload = await response.json();
      assert.equal(payload.error, 'Token non valido');
    }
  });
});

test('HTTP smoke: 4xx contract is preserved while 5xx details are hidden', async () => {
  await withHttpSecurityApp(async (baseUrl) => {
    const clientResponse = await fetch(`${baseUrl}/api/smoke/client-error`);
    assert.equal(clientResponse.status, 400);
    assert.deepEqual(await clientResponse.json(), {
      success: false,
      error: 'Errore specifico client',
      field: 'name'
    });

    const serverResponse = await fetch(`${baseUrl}/api/smoke/server-error`);
    assert.equal(serverResponse.status, 500);
    assert.deepEqual(await serverResponse.json(), {
      success: false,
      error: 'Errore interno del server',
      requestId: 'req-http-smoke-1'
    });
  });
});
