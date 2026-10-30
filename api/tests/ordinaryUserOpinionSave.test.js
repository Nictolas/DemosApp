const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');

const API_ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(API_ROOT, 'middleware/auth.js'));
const civicPath = require.resolve(path.join(API_ROOT, 'middleware/civicIdentity.js'));
const routePath = require.resolve(path.join(API_ROOT, 'routes/opinioni/user-answers.js'));

async function withOpinionApi({ consent = true } = {}, fn) {
  const writes = [];
  const originalAuth = require.cache[authPath];
  const originalCivic = require.cache[civicPath];
  const originalRoute = require.cache[routePath];
  const query = async (statement, params = []) => {
    const sql = String(statement).replace(/\s+/g, ' ').trim();
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) {
      writes.push(sql);
      return { rows: [], rowCount: 0 };
    }
    if (sql === 'SELECT id FROM users WHERE id = $1 FOR UPDATE') {
      writes.push('USER_LOCK');
      return { rows: [{id: 'ordinary-account'}], rowCount: 1 };
    }
    if (sql.includes('AS granted') && sql.includes('user_consents')) {
      if (writes.includes('USER_LOCK')) writes.push('CONSENT_AFTER_LOCK');
      return { rows: [{ granted: consent }], rowCount: 1 };
    }
    if (sql.includes('information_schema.columns') && sql.includes('opinioni_risposte')) {
      return { rows: [{ column_name: 'energia_nucleare' }], rowCount: 1 };
    }
    if (sql.includes('FROM opinioni_risposte') && sql.includes('FOR UPDATE')) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith('INSERT INTO opinioni_risposte')) {
      writes.push({ sql, params });
      return { rows: [], rowCount: 1 };
    }
    throw new Error('Unexpected SQL query: ' + sql);
  };
  const pool = { query, async connect() { return { query, release() {} }; } };
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: {
      pool,
      verifyToken: (req, res, next) => {
        if (req.get('authorization') !== 'Bearer test-user-token') {
          return res.status(401).json({ success: false, error: 'Autenticazione richiesta' });
        }
        req.userId = 'ordinary-account';
        req.user = { id: 'ordinary-account', isAdmin: false, isPolitician: false, isCandidate: false };
        next();
      },
      requireAdmin: (_req, res) => res.status(403).end(),
    }
  };
  require.cache[civicPath] = {
    id: civicPath, filename: civicPath, loaded: true,
    exports: {
      requireVerifiedCivicIdentity: (_req, res) => res.status(403).json({ code: 'CIVIC_IDENTITY_CIE_REQUIRED' })
    }
  };
  delete require.cache[routePath];
  const app = express();
  app.use(express.json());
  app.use('/api/opinioni', require(routePath));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn({ base: 'http://127.0.0.1:' + server.address().port, writes });
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [cachePath, original] of [
      [routePath, originalRoute],
      [authPath, originalAuth],
      [civicPath, originalCivic],
    ]) {
      if (original) require.cache[cachePath] = original;
      else delete require.cache[cachePath];
    }
  }
}

const request = (base, token = true) => fetch(base + '/api/opinioni/salva', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer test-user-token' } : {}),
  },
  body: JSON.stringify({ opinioni: { energia_nucleare: 'f' } }),
});

test('regular authenticated account with consent saves its opinion without CIE', async () => {
  await withOpinionApi({ consent: true }, async ({ base, writes }) => {
    const response = await request(base);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.savedCount, 1);
    assert.equal(body.errorCount, 0);
    assert.equal(writes.some(w => typeof w === 'object' && w.sql.startsWith('INSERT INTO opinioni_risposte')), true);
    assert.equal(writes.includes('COMMIT'), true);
    assert.ok(writes.indexOf('BEGIN') < writes.indexOf('USER_LOCK'));
    assert.ok(writes.indexOf('USER_LOCK') < writes.indexOf('CONSENT_AFTER_LOCK'));
    assert.ok(writes.indexOf('CONSENT_AFTER_LOCK') < writes.findIndex(x=>typeof x==='object'));
  });
});

test('non-admin without political opinion consent remains blocked', async () => {
  await withOpinionApi({ consent: false }, async ({ base, writes }) => {
    const response = await request(base);
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.consent_required, true);
    assert.equal(writes.length, 0);
  });
});

test('unauthenticated users cannot save personal opinions', async () => {
  await withOpinionApi({ consent: true }, async ({ base, writes }) => {
    const response = await request(base, false);
    assert.equal(response.status, 401);
    assert.equal(writes.length, 0);
  });
});
