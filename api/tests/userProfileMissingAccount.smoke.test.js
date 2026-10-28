'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware', 'auth.js'));
const auditPath = require.resolve(path.join(ROOT, 'middleware', 'auditMiddleware.js'));
const civicPath = require.resolve(path.join(ROOT, 'middleware', 'civicIdentity.js'));
const profilePath = require.resolve(path.join(ROOT, 'routes', 'users', 'profile.js'));
const searchPath = require.resolve(path.join(ROOT, 'routes', 'users', 'search.js'));
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function withRoutes(fn) {
  const cached = new Map();
  const patched = [authPath, auditPath, civicPath, profilePath, searchPath];
  for (const key of patched) cached.set(key, require.cache[key]);
  const statements = [];
  const client = {
    query: async (sql, params) => {
      const s = String(sql).trim();
      statements.push({ sql: s, params });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)) return { rows: [], rowCount: 0 };
      if (s.startsWith('UPDATE users SET')) return { rows: [], rowCount: 0 };
      throw new Error('Unexpected database query in absent-user test');
    },
    release: () => {},
  };
  const pool = { connect: async () => client, query: async () => { throw new Error('unexpected pool.query'); } };
  const mock = (key, exports) => {
    require.cache[key] = { id: key, filename: key, loaded: true, exports };
  };
  mock(authPath, { pool, verifyToken: (req, _res, next) => { req.user = { id: USER, ruolo: 'E' }; req.userId = USER; next(); }, requireAdmin: (_req, _res, next) => next() });
  mock(auditPath, { userDataAuditMiddleware: (_req, _res, next) => next() });
  mock(civicPath, { requireVerifiedCivicIdentity: (_req, _res, next) => next() });
  delete require.cache[profilePath];
  delete require.cache[searchPath];
  let server;
  try {
    const app = express();
    app.use(express.json());
    app.use('/api/users', require(profilePath));
    app.use('/api/users', require(searchPath));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    await fn({ url, statements });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [key, value] of cached) { if (value) require.cache[key] = value; else delete require.cache[key]; }
  }
}

async function put(url, endpoint, value) {
  return fetch(`${url}${endpoint}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
}

test('missing user does not create an orphan profile from self-edit or admin update', async () => {
  await withRoutes(async ({ url, statements }) => {
    const me = await put(url, '/api/users/me', { comune_residenza: 'Pisa' });
    assert.equal(me.status, 404);
    const admin = await put(url, `/api/users/${USER}`, { cittadinanza: 'it' });
    assert.equal(admin.status, 404);
    assert.equal(statements.filter(({sql}) => sql.startsWith('UPDATE users SET')).length, 2);
    assert.equal(statements.filter(({sql}) => sql.includes('INSERT INTO user_profile')).length, 0);
    assert.equal(statements.filter(({sql}) => sql === 'COMMIT').length, 2);
  });
});

test('missing user does not create an orphan profile via avatar update', async () => {
  await withRoutes(async ({ url, statements }) => {
    const response = await fetch(`${url}/api/users/me/avatar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ avatar_config: '{"color":"blue"}' }) });
    assert.equal(response.status, 404);
    assert.equal(statements.filter(({sql}) => sql.includes('INSERT INTO user_profile')).length, 0);
    assert.equal(statements.filter(({sql}) => sql === 'COMMIT').length, 1);
  });
});

test('admin profile editing rejects arrays without querying the database', async () => {
  await withRoutes(async ({ url, statements }) => {
    const response = await put(url, `/api/users/${USER}`, [{ cittadinanza: 'it' }]);
    assert.equal(response.status, 400);
    assert.equal(statements.length, 0);
  });
});
