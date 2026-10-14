const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  parseCookieHeader,
  getRefreshTokenFromRequest,
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

test('preferisce il refresh token HttpOnly al body legacy', () => {
  const result = getRefreshTokenFromRequest({
    headers: { cookie: `${REFRESH_TOKEN_COOKIE_NAME}=cookie-token` },
    body: { refreshToken: 'body-token' },
  });

  assert.deepEqual(result, { refreshToken: 'cookie-token', source: 'cookie' });
});

test('mantiene fallback body per client legacy/mobile', () => {
  const result = getRefreshTokenFromRequest({
    headers: {},
    body: { refreshToken: 'legacy-token' },
  });

  assert.deepEqual(result, { refreshToken: 'legacy-token', source: 'body' });
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
    process.env.NODE_ENV = previousNodeEnv;
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
