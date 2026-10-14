const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  parseCookieHeader,
  getRefreshTokenFromRequest,
  normalizeOrigin,
  getTrustedRefreshCookieOrigins,
  isTrustedRefreshCookieRequest,
  getRefreshTokenCookieOptions,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../services/refreshTokenCookieService');

test('parsa cookie senza dipendenza da cookie-parser', () => {
  assert.deepEqual(parseCookieHeader('a=1; demos_refresh=abc%2Edef; z=3'), {
    a: '1',
    demos_refresh: 'abc.def',
    z: '3',
  });
});

test('durante la migrazione il body legacy prevale su un eventuale cookie vecchio', () => {
  const result = getRefreshTokenFromRequest({
    headers: { cookie: `${REFRESH_TOKEN_COOKIE_NAME}=stale-cookie-token` },
    body: { refreshToken: 'current-body-token' },
  });

  assert.deepEqual(result, { refreshToken: 'current-body-token', source: 'body' });
});

test('usa il cookie HttpOnly quando il client non invia piu il token nel body', () => {
  const result = getRefreshTokenFromRequest({
    headers: { cookie: `${REFRESH_TOKEN_COOKIE_NAME}=cookie-token` },
    body: {},
  });

  assert.deepEqual(result, { refreshToken: 'cookie-token', source: 'cookie' });
});

test('mantiene fallback body per client legacy/mobile senza cookie', () => {
  const result = getRefreshTokenFromRequest({
    headers: {},
    body: { refreshToken: 'legacy-token' },
  });

  assert.deepEqual(result, { refreshToken: 'legacy-token', source: 'body' });
});

test('normalizza solo Origin validi', () => {
  assert.equal(normalizeOrigin('https://www.demos.community/path?q=1'), 'https://www.demos.community');
  assert.equal(normalizeOrigin('null'), null);
  assert.equal(normalizeOrigin('not-an-origin'), null);
});

test('include frontend configurato tra gli Origin cookie fidati', () => {
  const previousFrontend = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://preview.example.test/app';

  try {
    const origins = getTrustedRefreshCookieOrigins();
    assert.equal(origins.has('https://preview.example.test'), true);
    assert.equal(origins.has('https://www.demos.community'), true);
  } finally {
    if (previousFrontend === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = previousFrontend;
    }
  }
});

test('accetta cookie auth solo da Origin frontend fidato', () => {
  const trusted = isTrustedRefreshCookieRequest({
    headers: { origin: 'https://www.demos.community' },
  });
  const untrusted = isTrustedRefreshCookieRequest({
    headers: { origin: 'https://evil.example' },
  });
  const missing = isTrustedRefreshCookieRequest({ headers: {} });

  assert.equal(trusted, true);
  assert.equal(untrusted, false);
  assert.equal(missing, false);
});

test('cookie refresh e HttpOnly, SameSite Lax, path auth e TTL 7 giorni', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const options = getRefreshTokenCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.path, '/api/auth');
    assert.equal(options.maxAge, REFRESH_TOKEN_COOKIE_MAX_AGE_MS);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test('imposta e cancella il cookie con opzioni coerenti', () => {
  const calls = [];
  const res = {
    cookie: (...args) => calls.push(['set', ...args]),
    clearCookie: (...args) => calls.push(['clear', ...args]),
  };

  setRefreshTokenCookie(res, 'next-token');
  clearRefreshTokenCookie(res);

  assert.equal(calls[0][0], 'set');
  assert.equal(calls[0][1], REFRESH_TOKEN_COOKIE_NAME);
  assert.equal(calls[0][2], 'next-token');
  assert.equal(calls[0][3].httpOnly, true);

  assert.equal(calls[1][0], 'clear');
  assert.equal(calls[1][1], REFRESH_TOKEN_COOKIE_NAME);
  assert.equal(calls[1][2].path, '/api/auth');
  assert.equal('maxAge' in calls[1][2], false);
});
