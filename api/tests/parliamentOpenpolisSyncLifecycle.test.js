'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'sync-voti-openpolis.js'), 'utf8');
const routeSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'voti-camera.js'), 'utf8');

test('two Openpolis API syncs can reuse a pool without closing it after the first run', async () => {
  let selects = 0, closeCalls = 0;
  class MockPool {
    constructor() { this.closed = false; }
    async query(sql) {
      if (this.closed) throw new Error('Cannot use a pool after calling end on the pool');
      assert.match(sql, /FROM users u/);
      selects++;
      return { rows: [] };
    }
    async end() { closeCalls++; this.closed = true; }
  }
  const mod = { exports: {} };
  function fakeRequire(name) {
    if (name === 'dotenv') return { config() {} };
    if (name === 'pg') return { Pool: MockPool };
    if (name === 'axios') return { get: async () => { throw Error('network not allowed in test'); } };
    if (name === 'cheerio') return { load() { throw Error('HTML not used'); } };
    throw new Error('Unexpected import: ' + name);
  }
  fakeRequire.main = { exports: {} }; // API imports the module, it is not CLI main.
  const safeConsole = { log() {}, warn() {}, error() {} };
  const wrapper = vm.runInNewContext(
    '(function(require,module,exports,process,console){' + scriptSource + '\n})',
    { Date, Promise, parseInt }
  );
  wrapper(fakeRequire, mod, mod.exports, { env: { DATABASE_URL: 'postgres://synthetic-no-secret' } }, safeConsole);
  assert.equal(typeof mod.exports.syncVotiOpenpolis, 'function');
  await mod.exports.syncVotiOpenpolis();
  await mod.exports.syncVotiOpenpolis();
  assert.equal(selects, 2);
  assert.equal(closeCalls, 0, 'Only standalone CLI execution may shut down the module pool');
  assert.match(scriptSource, /if \(require\.main === module\) \{\s*await pool\.end\(\)/);
});

test('Admin Openpolis sync route never logs or returns raw upstream errors', async () => {
  const start = routeSource.indexOf('// POST /api/voti-camera/sync');
  const end = routeSource.indexOf('// POST /api/voti-camera/votazione/:votazione_id/spiegazione');
  assert.ok(start >= 0 && end > start, 'sync route must exist');
  const block = routeSource.slice(start, end);
  assert.doesNotMatch(block, /error\.message|error\.stack|console\.error\([^\n]*,\s*error\)/);

  const logs = [];
  const safeConsole = {
    log: (...args) => logs.push(args.join(' ')),
    warn: (...args) => logs.push(args.join(' ')),
    error: (...args) => logs.push(args.join(' '))
  };
  const auth = () => {}, admin = () => {};
  let handler;
  let throwSynchronously = false;
  const fakeRequire = name => {
    assert.equal(name, '../sync-voti-openpolis');
    if (throwSynchronously) throw Error('sensitive DATABASE_URL postgres://secret');
    return {
      syncVotiOpenpolis: () => Promise.reject(Error('upstream gsk_SYNTHETIC_SECRET'))
    };
  };
  vm.runInNewContext(block, {
    router: { post: (route, authentication, authorization, cb) => {
      assert.equal(route, '/sync');
      assert.equal(authentication, auth);
      assert.equal(authorization, admin);
      handler = cb;
    } },
    verifyToken: auth, requireAdmin: admin, require: fakeRequire, console: safeConsole
  });
  assert.equal(typeof handler, 'function');

  const response = () => ({
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  });
  const background = response();
  await handler({}, background);
  await Promise.resolve();
  assert.equal(background.statusCode, 200);
  assert.equal(background.body.success, true);
  throwSynchronously = true;
  const rejected = response();
  await handler({}, rejected);
  assert.equal(rejected.statusCode, 500);
  assert.equal(rejected.body.success, false);
  assert.doesNotMatch(JSON.stringify(rejected.body) + logs.join('\n'), /gsk_|postgres:\/\/secret|DATABASE_URL|sensitive/);
});

test('Openpolis job logs never disclose raw exception messages or stacks', () => {
  assert.doesNotMatch(scriptSource, /console\.(?:error|warn|log)\([^\n]*(?:error\.message|error\.stack|,\s*error\s*\))/);
  assert.doesNotMatch(scriptSource, /console\.error\([^\n]*,\s*error\)/);
});
