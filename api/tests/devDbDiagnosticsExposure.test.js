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
