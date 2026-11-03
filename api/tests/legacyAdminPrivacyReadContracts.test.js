'use strict';

// CI-only regression: preserve the stricter Admin GET privacy behavior from
// PR #562 while retiring legacy write endpoints on PR #579.
// All HTTP requests use Node loopback, a synthetic Admin and a rejecting DB stub.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const Module = require('node:module');
const express = require('express');

const routePath = require.resolve('../routes/admin/axiom-migration');
const sentinel = 'SYNTHETIC_SECRET_DB_ERROR_DO_NOT_EXPOSE';

function isolatedRouter(effects) {
  const originalLoad = Module._load;
  const saved = require.cache[routePath];
  const fakeAuth = {
    verifyToken(req, res, next) {
      if (!req.get('authorization')) return res.status(401).json({success:false});
      req.userId = 'synthetic-id';
      req.userEmail = 'private@example.invalid';
      req.userRole = 'P';
      next();
    },
    requireAdmin(req, res, next) {
      if (req.get('authorization') !== 'Bearer synthetic-admin') {
        return res.status(403).json({success:false});
      }
      next();
    },
    pool: {
      async query() {
        effects.queryCount++;
        throw new Error(sentinel);
      }
    }
  };

  Module._load = function isolatedLoad(request, parent, isMain) {
    if (parent?.filename === routePath && request === '../../middleware/auth') {
      return fakeAuth;
    }
    return originalLoad.apply(this, arguments);
  };
  try {
    delete require.cache[routePath];
    return require(routePath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[routePath];
    if (saved) require.cache[routePath] = saved;
  }
}

test('GET diagnostic endpoints keep no-store and redact synthetic DB errors and PII', async () => {
  const effects = {queryCount:0};
  const app = express();
  app.use('/api/admin/axiom-migration', isolatedRouter(effects));
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const routes = ['/test-auth','/migration-stats','/status'];
    for (const route of routes) {
      const url = base + '/api/admin/axiom-migration' + route;
      const anonymous = await fetch(url);
      assert.equal(anonymous.status,401,'anonymous ' + route);
      const unprivileged = await fetch(url, {headers:{authorization:'Bearer synthetic-reader'}});
      assert.equal(unprivileged.status,403,'non-Admin ' + route);
      const response = await fetch(url, {headers:{authorization:'Bearer synthetic-admin'}});
      assert.equal(response.status,200,'Admin ' + route);
      assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0',route);
      const payload = await response.json();
      const serialized = JSON.stringify(payload);
      assert.doesNotMatch(serialized,/SYNTHETIC_SECRET_DB_ERROR_DO_NOT_EXPOSE|private@example\.invalid/);
      if (route === '/test-auth') {
        assert.equal(payload.user.id,'synthetic-id');
        assert.ok(!Object.hasOwn(payload.user,'email'),'no user email in diagnostic response');
      }
      if (route === '/migration-stats') {
        assert.equal(payload.migrationVerified,false,'must not certify legacy transfer');
        assert.match(payload.message,/NON verificata/i);
      }
    }
    assert.ok(effects.queryCount >= 2,'only synthetic database query attempted');
  } finally {
    await new Promise((resolve, reject) => server.close(err => err?reject(err):resolve()));
  }
});

test('data export GET handlers must not echo raw provider/database error messages', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/admin/data-export.js'),'utf8');
  assert.doesNotMatch(source, /(?:message|error):\s*(?:err|error|sdkQueryErr)\.message/);
  assert.match(source, /(?:error|message):\s*'Dettaglio non disponibile'/);
  const axiom = fs.readFileSync(routePath,'utf8');
  assert.doesNotMatch(axiom, /(?:message|error):\s*(?:err|error)\.message/);
  assert.match(axiom, /migrationVerified:\s*false/);
});
