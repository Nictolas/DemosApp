'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { readFileSync } = require('node:fs');

// The router is exercised over loopback HTTP with invented auth and services.
// No real users, databases, backups, files, credentials or providers are used.
async function withRouter(run) {
  const modulePaths = [
    '../middleware/auth',
    '../services/backupService',
    '../jobs/backupJob',
    '../routes/admin/backup'
  ].map(path => require.resolve(path));
  const originals = modulePaths.map(path => require.cache[path]);
  let sideEffects = 0;
  let server;
  const rejectSideEffect = () => {
    sideEffects += 1;
    throw new Error('LEGACY_BACKUP_SIDE_EFFECT_MUST_NOT_RUN');
  };
  try {
    const middleware = {
      verifyToken(req, res, next) {
        if (req.get('authorization') !== 'Bearer synthetic-admin') {
          return res.status(401).json({ success: false });
        }
        return next();
      },
      requireAdmin(req, res, next) {
        if (req.get('x-test-role') !== 'admin') {
          return res.status(403).json({ success: false });
        }
        return next();
      }
    };
    const service = new Proxy({}, {
      get() { return rejectSideEffect; }
    });
    const job = new Proxy({}, {
      get() { return rejectSideEffect; }
    });
    for (let index = 0; index < 3; index++) {
      const exports = [middleware, service, job][index];
      require.cache[modulePaths[index]] = {
        id: modulePaths[index],
        filename: modulePaths[index],
        loaded: true,
        exports
      };
    }
    delete require.cache[modulePaths[3]];
    const app = express();
    app.use(express.json());
    app.use('/api/admin/backup', require('../routes/admin/backup'));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const request = async (method, suffix, headers = {}) => fetch(
      origin + '/api/admin/backup' + suffix,
      {
        method,
        headers,
        signal: AbortSignal.timeout(3000)
      }
    );
    await run(request, () => sideEffects);
  } finally {
    if (server) {
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
    modulePaths.forEach((path, index) => {
      delete require.cache[path];
      if (originals[index]) require.cache[path] = originals[index];
    });
  }
}

test('backup paths keep authentication and Admin authorization before retirement', async () => {
  await withRouter(async (request, sideEffects) => {
    for (const path of ['/verify/synthetic.json', '/stats', '/job/stop']) {
      const method = path === '/job/stop' ? 'POST' : 'GET';
      const noAuth = await request(method, path);
      assert.equal(noAuth.status, 401);
      await noAuth.text();
      const nonAdmin = await request(method, path, {
        authorization: 'Bearer synthetic-admin'
      });
      assert.equal(nonAdmin.status, 403);
      await nonAdmin.text();
    }
    assert.equal(sideEffects(), 0);
  });
});

test('all legacy backup HTTP endpoints return no-store 410 without service calls', async () => {
  await withRouter(async (request, sideEffects) => {
    const cases = [
      ['GET', '/stats'],
      ['GET', '/list'],
      ['GET', '/verify/synthetic-backup.json'],
      ['GET', '/verify/%2e%2e%2fsynthetic-secret.txt'],
      ['GET', '/job/status'],
      ['GET', '/config'],
      ['POST', '/job/stop'],
      ['POST', '/job/start'],
      ['POST', '/job/immediate'],
      ['POST', '/create/full'],
      ['POST', '/create/incremental'],
      ['POST', '/restore/synthetic-backup.json'],
      ['POST', '/cleanup'],
      ['POST', '/test/integrity']
    ];
    for (const [method, path] of cases) {
      const response = await request(method, path, {
        authorization: 'Bearer synthetic-admin',
        'x-test-role': 'admin'
      });
      assert.equal(response.status, 410, method + ' ' + path);
      assert.match(response.headers.get('cache-control') || '', /no-store/);
      assert.deepEqual(await response.json(), {
        success: false,
        error: 'LEGACY_APP_BACKUP_RETIRED'
      });
    }
    assert.equal(sideEffects(), 0);
  });
});

test('retired backup router contains no legacy file, database or job implementation', () => {
  const source = readFileSync(require.resolve('../routes/admin/backup'), 'utf8');
  assert.doesNotMatch(source, /require\(['"]\.\.\/\.\.\/services\/backupService['"]\)/);
  assert.doesNotMatch(source, /require\(['"]\.\.\/\.\.\/jobs\/backupJob['"]\)/);
  assert.doesNotMatch(source, /readFile|writeFile|unlink|pg\.|pool\.query|restoreFromBackup/);
  assert.match(source, /LEGACY_APP_BACKUP_RETIRED/);
});
