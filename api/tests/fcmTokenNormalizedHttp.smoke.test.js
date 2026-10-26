'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require('express');

const USER = '00000000-0000-4000-8000-000000000601';
const routePath = require.resolve(path.join(__dirname, '..', 'routes', 'fcm-tokens.js'));
const databasePath = require.resolve(path.join(__dirname, '..', 'config', 'database.js'));
const authPath = require.resolve(path.join(__dirname, '..', 'middleware', 'auth.js'));

function makeFakeDatabase({ legacy = [], canonical = [], legacyColumnMissing = false } = {}) {
  const state = {
    legacy: [...legacy],
    devices: canonical.map(item => ({ ...item })),
    queries: [],
  };
  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    state.queries.push({ sql: s, params });
    if (s.startsWith('SELECT COALESCE(fcm_tokens') && s.includes('FROM public.users')) {
      if (legacyColumnMissing) throw Object.assign(Error('synthetic column missing'), { code: '42703' });
      return { rows: [{ fcm_tokens: [...state.legacy] }] };
    }
    if (s.startsWith('SELECT 1 FROM public.users')) return { rows: [{ '?column?': 1 }] };
    if (s.startsWith('UPDATE public.users SET fcm_tokens')) {
      if (legacyColumnMissing) throw Object.assign(Error('synthetic column missing'), { code: '42703' });
      state.legacy = [...params[0]];
      return { rowCount: 1, rows: [] };
    }
    if (s.startsWith('INSERT INTO public.user_devices')) {
      const [userId, token] = params;
      const match = state.devices.find(item => item.token === token);
      if (match) {
        match.userId = userId;
        match.active = true;
      } else state.devices.push({ userId, token, active: true });
      return { rowCount: 1, rows: [] };
    }
    if (s.startsWith('UPDATE public.user_devices') && s.includes('btrim(fcm_token) <> $2')) {
      for (const item of state.devices) {
        if (item.userId === params[0] && item.token.trim() !== params[1]) item.active = false;
      }
      return { rowCount: 1, rows: [] };
    }
    if (s.startsWith('UPDATE public.user_devices') && s.includes('btrim(fcm_token) = $2')) {
      for (const item of state.devices) {
        if (item.userId === params[0] && item.token.trim() === params[1]) item.active = false;
      }
      return { rowCount: 1, rows: [] };
    }
    if (s.startsWith('UPDATE public.user_devices') && s.includes('WHERE user_id = $1')) {
      for (const item of state.devices) if (item.userId === params[0]) item.active = false;
      return { rowCount: 1, rows: [] };
    }
    throw Error('Unexpected SQL in FCM synthetic HTTP test: ' + s);
  };
  return { state, query };
}

async function withSyntheticFcmRouter(pool, exercise) {
  const modulePaths = [routePath, databasePath, authPath];
  const oldCache = new Map(modulePaths.map(p => [p, require.cache[p]]));
  let server;
  const mock = (modulePath, exports) => {
    require.cache[modulePath] = {
      id: modulePath, filename: modulePath, loaded: true, exports,
    };
  };
  try {
    mock(databasePath, { getPool: () => pool });
    mock(authPath, { verifyToken(req, res, next) {
      req.user = { id: USER };
      next();
    } });
    delete require.cache[routePath];
    const router = require(routePath);
    const app = express();
    app.use(express.json());
    app.use('/api/fcm-tokens', router);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/api/fcm-tokens';
    await exercise(base);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [modulePath, previous] of oldCache) {
      if (previous) require.cache[modulePath] = previous;
      else delete require.cache[modulePath];
    }
  }
}

const mobile = { 'user-agent': 'Mozilla/5.0 (Linux; Android 16; Mobile)', 'content-type': 'application/json' };
const rawToken = 'X'.repeat(125);
const oldToken = 'Y'.repeat(125);

test('HTTP POST normalizes a new mobile token before both legacy and canonical persistence', async () => {
  const pool = makeFakeDatabase({
    legacy: [' ' + rawToken + ' ', oldToken],
    canonical: [{ userId: USER, token: oldToken, active: true }],
  });
  await withSyntheticFcmRouter(pool, async base => {
    const response = await fetch(base, {
      method: 'POST', headers: mobile, body: JSON.stringify({ token: '  ' + rawToken + '\t' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(pool.state.legacy, [rawToken]);
    const stored = pool.state.devices.find(d => d.token === rawToken);
    assert.ok(stored && stored.active, 'new token must be saved without outer whitespace');
    assert.equal(pool.state.devices.find(d => d.token === oldToken).active, false);
    const insert = pool.state.queries.find(q => q.sql.startsWith('INSERT INTO public.user_devices'));
    assert.deepEqual(insert.params, [USER, rawToken]);
    assert.ok(pool.state.queries.every(q => !/\b(?:FROM|UPDATE|INTO) users\b|\b(?:FROM|UPDATE|INTO) user_devices\b/i.test(q.sql)),
      'route must never resolve shadow tables');
  });
});

test('HTTP POST rejects non-string, short-after-trim and fake web_ tokens before any query', async () => {
  const pool = makeFakeDatabase();
  await withSyntheticFcmRouter(pool, async base => {
    for (const token of [{ value: rawToken }, null, ' '.repeat(25) + 'a'.repeat(98), '   web_' + 'z'.repeat(130)]) {
      const response = await fetch(base, {
        method: 'POST', headers: mobile, body: JSON.stringify({ token }),
      });
      assert.equal(response.status, 400);
    }
    assert.equal(pool.state.queries.length, 0);
  });
});

test('HTTP cleanup normalizes only explicitly selected valid token, without bulk migration', async () => {
  const pool = makeFakeDatabase({
    legacy: [oldToken, '  ' + rawToken + '  '],
    canonical: [{ userId: USER, token: oldToken, active: true }],
  });
  await withSyntheticFcmRouter(pool, async base => {
    const response = await fetch(base + '/cleanup', { method: 'POST', headers: mobile });
    assert.equal(response.status, 200);
    assert.deepEqual(pool.state.legacy, [rawToken]);
    assert.equal(pool.state.devices.find(d => d.token === oldToken).active, false);
    assert.equal(pool.state.devices.find(d => d.token === rawToken).active, true);
  });
});

test('HTTP DELETE revokes padded historical canonical and legacy copies of one token', async () => {
  const pool = makeFakeDatabase({
    legacy: [' ' + rawToken + ' ', oldToken],
    canonical: [
      { userId: USER, token: '  ' + rawToken + ' ', active: true },
      { userId: USER, token: oldToken, active: true },
    ],
  });
  await withSyntheticFcmRouter(pool, async base => {
    const response = await fetch(base + '/' + encodeURIComponent(' ' + rawToken + ' '), {
      method: 'DELETE', headers: mobile,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(pool.state.legacy, [oldToken]);
    assert.equal(pool.state.devices.find(d => d.token.trim() === rawToken).active, false);
    assert.equal(pool.state.devices.find(d => d.token === oldToken).active, true);
    assert.ok(pool.state.queries.some(q =>
      q.sql.includes('UPDATE public.user_devices') &&
      q.sql.includes('btrim(fcm_token) = $2') && q.params[1] === rawToken
    ));
  });
});

test('HTTP POST retains column-missing legacy fallback without skipping canonical token writes', async () => {
  const pool = makeFakeDatabase({ legacyColumnMissing: true });
  await withSyntheticFcmRouter(pool, async base => {
    const response = await fetch(base, {
      method: 'POST', headers: mobile, body: JSON.stringify({ token: '   ' + rawToken + ' ' }),
    });
    assert.equal(response.status, 200);
    assert.equal(pool.state.devices.find(d => d.token === rawToken).active, true);
    assert.ok(pool.state.queries.some(q => q.sql.startsWith('SELECT 1 FROM public.users')));
    assert.equal(pool.state.legacy.length, 0);
  });
});
