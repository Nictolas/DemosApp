const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(64);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'b'.repeat(64);

const { securityMiddleware, _test } = require('../middleware/security');
const { generateAccessToken, generateOAuthPendingToken } = require('../utils/jwt');

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
