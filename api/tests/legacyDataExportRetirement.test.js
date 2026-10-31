'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const express = require('express');

const routePath = require.resolve('../routes/admin/data-export');

function loadIsolatedRouter(effects) {
  const originalLoad = Module._load;
  const cached = require.cache[routePath];

  const verifyToken = (req, res, next) => {
    if (!req.get('authorization')) return res.status(401).json({ success: false });
    req.userId = 'synthetic-test-user';
    next();
  };
  const requireAdmin = (req, res, next) => {
    if (req.get('authorization') !== 'Bearer synthetic-admin') {
      return res.status(403).json({ success: false });
    }
    next();
  };
  class BlockedPool {
    query() { effects.sql++; throw new Error('Unexpected SQL from export retirement test'); }
    connect() { effects.sql++; throw new Error('Unexpected DB connection'); }
  }

  Module._load = function isolatedLoad(request, parent, isMain) {
    if (parent && parent.filename === routePath) {
      if (request === '../../middleware/auth') return { verifyToken, requireAdmin };
      if (request === 'pg') return { Pool: BlockedPool };
      if (request === 'child_process') return {
        spawn() { effects.spawn++; throw new Error('Unexpected process spawn'); }
      };
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    delete require.cache[routePath];
    return require(routePath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[routePath];
    if (cached) require.cache[routePath] = cached;
  }
}

test('Legacy export POST /start is fail-closed over real Express HTTP', async () => {
  const effects = { sql: 0, spawn: 0 };
  const app = express();
  app.use(express.json());
  app.use('/api/admin/data-export', loadIsolatedRouter(effects));

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const cases = [
      { name: 'anonymous', token: null, payload: { tables: ['audit_logs'] }, status: 401 },
      { name: 'non-admin', token: 'Bearer synthetic-user', payload: { tables: ['audit_logs'] }, status: 403 },
      { name: 'admin normal', token: 'Bearer synthetic-admin', payload: { tables: ['audit_logs'] }, status: 410 },
      { name: 'admin delete flag', token: 'Bearer synthetic-admin', payload: { tables: ['audit_logs'], deleteAfterExport: true }, status: 410 },
      { name: 'admin string delete flag', token: 'Bearer synthetic-admin', payload: { tables: ['audit_logs'], deleteAfterExport: 'true' }, status: 410 },
      { name: 'admin dry run', token: 'Bearer synthetic-admin', payload: { tables: ['audit_logs'], dryRun: true }, status: 410 },
      { name: 'admin empty payload', token: 'Bearer synthetic-admin', payload: {}, status: 410 },
      { name: 'admin no body', token: 'Bearer synthetic-admin', status: 410 }
    ];

    for (const entry of cases) {
      const headers = { 'content-type': 'application/json' };
      if (entry.token) headers.authorization = entry.token;
      const response = await fetch(base + '/api/admin/data-export/start', {
        method: 'POST', headers,
        ...(entry.payload === undefined ? {} : { body: JSON.stringify(entry.payload) })
      });
      assert.equal(response.status, entry.status, entry.name);
      const body = await response.json();
      assert.equal(body.success, false, entry.name);
      if (entry.status === 410) {
        assert.equal(response.headers.get('cache-control'), 'no-store', entry.name);
        assert.match(body.error, /Export legacy non disponibile/);
      }
    }

    const statusRes = await fetch(base + '/api/admin/data-export/status', {
      headers: { authorization: 'Bearer synthetic-admin' }
    });
    assert.equal(statusRes.status, 200, 'other admin GET stays available');
    const stopRes = await fetch(base + '/api/admin/data-export/stop', {
      method: 'POST', headers: { authorization: 'Bearer synthetic-admin' }
    });
    assert.equal(stopRes.status, 400, 'no export process started');
    assert.deepEqual(effects, { sql: 0, spawn: 0 }, 'no SQL or subprocess');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('Legacy export frontend cannot start or select destructive export', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/DataExport.tsx'), 'utf8');
  assert.match(source, /Export su disco temporaneamente non disponibile/);
  assert.match(source, /checked=\{deleteAfterExport\} disabled/);
  assert.match(source, /<Button onClick=\{startExport\} disabled=\{true\}>/);
});
