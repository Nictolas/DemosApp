'use strict';

// Production middleware and actual route handlers under Express HTTP.
// Only JWT decoding, account lookup and external I/O are replaced by synthetic fixtures.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

const authPath = require.resolve('../middleware/auth');
const exportPath = require.resolve('../routes/admin/data-export');
const axiomPath = require.resolve('../routes/admin/axiom-migration');

function loadRealAuthorizationWithSyntheticServices(effects) {
  const originalLoad = Module._load;
  const paths = [authPath, exportPath, axiomPath];
  const previous = new Map(paths.map(p => [p, require.cache[p]]));
  const previousEnv = process.env.NODE_ENV;
  const subject = id => {
    if (id === 'missing-account') return null;
    return {
      id,
      status: id === 'inactive-account' ? 'x' : 'a',
      legacyRole: id === 'role-only-account' ? 'admin' : 'P',
      capabilities: {
        accountType: 'P',
        isAdmin: id === 'actual-admin',
        isActivist: false,
        isCandidate: false,
        isPolitician: false
      }
    };
  };
  const noDatabase = () => {
    effects.database++;
    throw new Error('Real database access forbidden in synthetic auth integration');
  };
  class BlockedPool {
    query() { return noDatabase(); }
    connect() { return noDatabase(); }
  }
  const realAuth = {};
  Module._load = function isolatedDependencies(request, parent, isMain) {
    if (parent?.filename === authPath) {
      if (request === '../utils/jwt') {
        return {
          verifyAccessToken(token) {
            if (!token.startsWith('synthetic:')) throw new Error('invalid token');
            return { userId: token.slice('synthetic:'.length) };
          }
        };
      }
      if (request === '../config/database') {
        return { getPool: () => ({ query: noDatabase, connect: noDatabase }) };
      }
      if (request === '../services/redisCache') {
        return { isEnabled: () => false };
      }
      if (request === '../services/accountCapabilitiesService') {
        return {
          async getAccountSubject(_pool, id) {
            effects.accountLookups++;
            return subject(id);
          }
        };
      }
    }
    if (parent?.filename === exportPath || parent?.filename === axiomPath) {
      if (request === '../../middleware/auth') return realAuth;
      if (request === 'pg') return { Pool: BlockedPool };
      if (request === 'child_process') return {
        spawn() { effects.processes++; throw new Error('Spawn not allowed'); }
      };
      if (request === 'axios') return {
        get() { effects.axiom++; throw new Error('Provider request not allowed'); }
      };
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    process.env.NODE_ENV = 'production';
    paths.forEach(p => { delete require.cache[p]; });
    Object.assign(realAuth, require(authPath));
    assert.equal(typeof realAuth.verifyToken, 'function');
    assert.equal(typeof realAuth.requireAdmin, 'function');
    return {
      exportRouter: require(exportPath),
      axiomRouter: require(axiomPath)
    };
  } finally {
    Module._load = originalLoad;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
    paths.forEach(p => {
      delete require.cache[p];
      if (previous.get(p)) require.cache[p] = previous.get(p);
    });
  }
}

test('real verifyToken and requireAdmin protect all retired POST routes without provider I/O', async () => {
  const effects = { database: 0, accountLookups: 0, processes: 0, axiom: 0 };
  const { exportRouter, axiomRouter } = loadRealAuthorizationWithSyntheticServices(effects);
  const app = express();
  app.use(express.json());
  app.use('/api/admin/data-export', exportRouter);
  app.use('/api/admin/axiom-migration', axiomRouter);

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const routes = [
      { url: '/api/admin/data-export/start', body: { tables: ['audit_logs'], deleteAfterExport: true } },
      { url: '/api/admin/axiom-migration/delete-migrated', body: { tables: ['centralized_logs', 'audit_logs'], confirm: 'DELETE' } },
      { url: '/api/admin/axiom-migration/migrate', body: { tables: ['centralized_logs', 'audit_logs'], dryRun: false } },
      { url: '/api/admin/axiom-migration/migrate', body: { tables: ['audit_logs'], dryRun: true } }
    ];
    const accounts = [
      { name: 'missing Authorization', token: null, status: 401 },
      { name: 'invalid Authorization', token: 'Bearer invalid', status: 401 },
      { name: 'bad Bearer scheme', token: 'Basic synthetic:actual-admin', status: 401 },
      { name: 'no user in synthetic directory', token: 'Bearer synthetic:missing-account', status: 401 },
      { name: 'inactive synthetic account', token: 'Bearer synthetic:inactive-account', status: 401 },
      { name: 'reader without Admin capability', token: 'Bearer synthetic:regular-account', status: 403 },
      { name: 'legacy admin label without capability', token: 'Bearer synthetic:role-only-account', status: 403 },
      { name: 'actual synthetic Admin capability', token: 'Bearer synthetic:actual-admin', status: 410 }
    ];
    for (const route of routes) {
      for (const entry of accounts) {
        const headers = { 'content-type': 'application/json' };
        if (entry.token) headers.authorization = entry.token;
        const response = await fetch(base + route.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(route.body)
        });
        assert.equal(response.status, entry.status, route.url + ': ' + entry.name);
        const body = await response.json();
        assert.equal(body.success, false, route.url + ': ' + entry.name);
        if (entry.status === 410) {
          assert.equal(response.headers.get('cache-control'), 'no-store');
        }
      }
    }
    assert.ok(effects.accountLookups > 0, 'real middleware performed synthetic account lookups');
    assert.equal(effects.database, 0, 'no real SQL execution');
    assert.equal(effects.processes, 0, 'no subprocesses');
    assert.equal(effects.axiom, 0, 'no Axiom HTTP');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('both routers are mounted under the actual app admin rate limiter', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
  assert.match(app, /app\.use\('\/api\/admin\/data-export', adminLimiter, dataExportRoutes\)/);
  assert.match(app, /app\.use\('\/api\/admin\/axiom-migration', adminLimiter, axiomMigrationRoutes\)/);
});
