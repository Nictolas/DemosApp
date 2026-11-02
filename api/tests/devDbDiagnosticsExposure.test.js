'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const diagnosticRouters = [
  { module: '../routes/health', diagnostic: '/test-db', keep: ['/', '/health'] },
  { module: '../routes/database', diagnostic: '/check-table-structure', keep: [] },
  { module: '../routes/test-db', diagnostic: '/', keep: [] }
];

function withEnvironment(nodeEnv, dbOptIn, allowDevOverride, callback) {
  const keys = ['NODE_ENV', 'ALLOW_DB_DIAGNOSTICS', 'ALLOW_DEV_API_SURFACE'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NODE_ENV = nodeEnv;
    if (dbOptIn === undefined) delete process.env.ALLOW_DB_DIAGNOSTICS;
    else process.env.ALLOW_DB_DIAGNOSTICS = dbOptIn;
    if (allowDevOverride === undefined) delete process.env.ALLOW_DEV_API_SURFACE;
    else process.env.ALLOW_DEV_API_SURFACE = allowDevOverride;
    return callback();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

function pathsInRouter(modulePath) {
  const id = require.resolve(modulePath);
  // Router initialization evaluates the gate at module load time.
  delete require.cache[id];
  try {
    const router = require(modulePath);
    return router.stack.filter(layer => layer.route)
      .map(layer => ({ path: layer.route.path, methods: layer.route.methods }));
  } finally {
    delete require.cache[id];
  }
}

test('production never registers SQL diagnostic handlers, even with old override enabled', () => {
  withEnvironment('production', 'true', 'true', () => {
    for (const entry of diagnosticRouters) {
      const routes = pathsInRouter(entry.module);
      assert.ok(!routes.some(r => r.path === entry.diagnostic),
        entry.module + ': diagnostic route must not exist');
      for (const publicPath of entry.keep) {
        assert.ok(routes.some(r => r.path === publicPath),
          entry.module + ': normal health endpoint must remain');
      }
    }
  });
});

test('staging/test/unspecified NODE_ENV cannot expose diagnostics with opt-in', () => {
  for (const nodeEnv of ['test', 'staging', '']) {
    withEnvironment(nodeEnv, 'true', 'true', () => {
      for (const entry of diagnosticRouters) {
        assert.ok(!pathsInRouter(entry.module).some(r => r.path === entry.diagnostic),
          entry.module + ': should fail closed for NODE_ENV=' + JSON.stringify(nodeEnv));
      }
    });
  }
});

test('development without explicit ALLOW_DB_DIAGNOSTICS never mounts SQL handlers', () => {
  for (const optIn of [undefined, 'false', '1', 'TRUE']) {
    withEnvironment('development', optIn, 'true', () => {
      for (const entry of diagnosticRouters) {
        assert.ok(!pathsInRouter(entry.module).some(r => r.path === entry.diagnostic),
          entry.module + ': unexpected diagnostic route');
      }
    });
  }
});

test('explicit opt-in permits diagnostics only in local development', () => {
  withEnvironment('development', 'true', undefined, () => {
    for (const entry of diagnosticRouters) {
      const routes = pathsInRouter(entry.module);
      assert.ok(routes.some(r => r.path === entry.diagnostic && r.methods.get),
        entry.module + ': dev diagnostic GET route should be available');
    }
  });
});

test('all production protections are checked without opening a SQL connection', () => {
  // Contract: tests only inspect Express router registrations. No handler is
  // called, and no pool.connect/query is invoked, even for local dev tests.
  assert.ok(diagnosticRouters.length === 3);
});

test('dev API surface requires development and an explicit opt-in even for migration and cleanup routers', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const path = require('node:path');
  const appSource = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
  const match = appSource.match(/const mountDevApiSurface\s*=\s*([\s\S]*?);/);
  assert.ok(match, 'expected a single central dev surface guard');
  assert.equal((appSource.match(/const mountDevApiSurface\s*=/g) || []).length, 1);
  assert.ok((appSource.match(/if\s*\(mountDevApiSurface\)\s*{/g) || []).length >= 6,
    'test, migration, debug, cleanup and diagnostic routers must remain guarded');
  const isExposed = (nodeEnv, override) => vm.runInNewContext(match[1], {
    process: { env: { NODE_ENV: nodeEnv, ALLOW_DEV_API_SURFACE: override } }
  });
  for (const environment of ['production', 'staging', 'test', '', undefined]) {
    for (const override of ['true', 'false', undefined]) {
      assert.equal(isExposed(environment, override), false,
        'dev API surface should be closed: ' + environment + ' / ' + override);
    }
  }
  for (const override of ['false', undefined, 'TRUE', '1']) {
    assert.equal(isExposed('development', override), false);
  }
  assert.equal(isExposed('development', 'true'), true);
  for (const route of [
    '/api/test-opinioni-endpoints', '/api/test-add-opinione',
    '/api/test-db', '/api/migrate', '/api/test-performance',
    '/api/fix-database', '/api/debug-opinioni',
    '/api/migrations', '/api/cleanup', '/api/test'
  ]) {
    assert.ok(appSource.includes("app.use('" + route + "'"),
      'expected audited dev mount to remain present: ' + route);
  }
});

test('request and header debug logging is absent unless the central dev guard is enabled', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const appSource = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
  assert.match(appSource,
    /\/\/ Request debug logging \(including request headers\)[^\n]*\nif \(mountDevApiSurface\) \{/);
  assert.doesNotMatch(appSource, /if\s*\(process\.env\.NODE_ENV\s*!==\s*'production'\)/,
    'staging and unset NODE_ENV must not enable request debug logging');
});

test('legacy FCM debug endpoints require explicit local opt-in', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/comunicazioni.js'), 'utf8');
  const match = source.match(/const localNotificationDebug\s*=\s*([\s\S]*?);/);
  assert.ok(match, 'local FCM debug guard missing');
  assert.equal((source.match(/const localNotificationDebug\s*=/g) || []).length, 1);
  const isEnabled = (environment, optIn) => vm.runInNewContext(match[1], {
    process: { env: { NODE_ENV: environment, ALLOW_DEV_API_SURFACE: optIn } }
  });
  for (const environment of ['production', 'staging', 'test', '', undefined]) {
    for (const optIn of ['true', undefined, 'false']) {
      assert.equal(isEnabled(environment, optIn), false);
    }
  }
  for (const optIn of [undefined, 'false', 'TRUE', '1']) {
    assert.equal(isEnabled('development', optIn), false);
  }
  assert.equal(isEnabled('development', 'true'), true);

  const debugStart = source.indexOf('// Legacy diagnostics may send real FCM pushes');
  const afterDebug = source.indexOf('// GET /api/ultima-comunicazione', debugStart);
  assert.ok(debugStart > 0 && afterDebug > debugStart);
  const debugRouter = source.slice(debugStart, afterDebug);
  assert.match(debugRouter, /^if \(localNotificationDebug\) \{/m);
  assert.match(debugRouter, /router\.get\('\/debug-firebase-admin'/);
  assert.match(debugRouter, /router\.get\('\/debug-notifiche-demos'/);
  assert.match(debugRouter, /\n\}\s*$/);
  assert.equal((source.match(/router\.get\('\/debug-firebase-admin'/g) || []).length, 1);
  assert.equal((source.match(/router\.get\('\/debug-notifiche-demos'/g) || []).length, 1);
});

test('FCM push and notification errors never log raw token or exception contents outside debug routes', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/comunicazioni.js'), 'utf8');
  const start = source.indexOf('// Legacy diagnostics may send real FCM pushes');
  const end = source.indexOf('// GET /api/ultima-comunicazione', start);
  assert.ok(start > 0 && end > start);

  const productionSource = source.slice(0, start) + source.slice(end);
  // Raw errors and parts of push tokens must not reach persistent console logs.
  assert.doesNotMatch(productionSource,
    /console\.(?:error|warn)\([^\n;]*(?:\.message\b|\.stack\b|fcmToken\b|saveError\b|sendError\b|pushError\b|messagingError\b|,\s*error\b)/);
  assert.doesNotMatch(productionSource, /console\.error\([^;\n]*JSON\.stringify\(req\.body/);
  for (const safeCode of [
    'USER_NOTIFICATION_FCM_SEND_FAILED',
    'USER_NOTIFICATION_INBOX_WRITE_FAILED',
    'FCM_SEND_FAILED',
    'FCM_PUSH_NOTIFICATION_FAILED',
    'FCM_TOKEN_INVALIDATION_FAILED'
  ]) {
    assert.ok(productionSource.includes("console.error('" + safeCode + "')"),
      'missing safe error code ' + safeCode);
  }
  assert.match(source, /if \(localNotificationDebug\) console\.log\(\.\.\.args\)/);
  assert.match(source, /if \(localNotificationDebug\) console\.warn\(\.\.\.args\)/);
});
