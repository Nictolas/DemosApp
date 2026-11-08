'use strict';
// Synthetic-only route test: no PostgreSQL, identity, user account or network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/attivismo-tipologie.js'), 'utf8');
const OWN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function harness({ exists = true } = {}) {
  const statements = [];
  const logs = [];
  const routes = new Map();
  class FakePool {
    async query(sql, params = []) {
      statements.push({ sql: String(sql), params });
      if (/^SELECT 1 FROM users WHERE id = \$1$/.test(String(sql))) {
        return { rows: exists ? [{ '?column?': 1 }] : [] };
      }
      if (String(sql).startsWith('UPDATE users SET tipologie_attivismo')) {
        return { rows: [{ tipologie_attivismo: params[0] }] };
      }
      throw Error('Unexpected database access');
    }
  }
  const noop = (_req, _res, next) => next();
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod,
    process: { env: { NODE_ENV: 'test' } },
    console: {
      log: (...args) => logs.push(args.join(' ')),
      warn: (...args) => logs.push(args.join(' ')),
      error: (...args) => logs.push(args.join(' '))
    },
    require: (name) => {
      if (name === 'express') return { Router: () => ({
        get() {},
        put: (route, ...handlers) => routes.set(route, handlers)
      }) };
      if (name === 'pg') return { Pool: FakePool };
      if (name === 'dotenv') return { config() {} };
      if (name === '../middleware/auth') return { verifyToken: noop };
      throw Error('Unexpected dependency');
    }
  }, { filename: 'attivismo-tipologie.js' });
  const route = routes.get('/:userId');
  assert.ok(route, 'actual PUT route must be mounted');
  const call = async (userId, actor, tipologie = ['ambiente']) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await route.at(-1)({ params: { userId }, user: actor, body: { tipologie } }, res);
    return res;
  };
  return { statements, logs, call };
}

test('another user cannot inspect a profile or trigger SQL through activism edit', async () => {
  const h = harness();
  const res = await h.call(OTHER, { id: OWN, isAdmin: false });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(h.statements.length, 0);
  assert.deepEqual(h.logs, []);
});

test('an account holder may edit activism types without reading names or roles', async () => {
  const h = harness();
  const res = await h.call(OWN, { id: OWN, isAdmin: false });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Tipologie di attivismo aggiornate');
  assert.equal(h.statements.length, 2);
  assert.match(h.statements[0].sql, /^SELECT 1 FROM users WHERE id = \$1$/);
  assert.match(h.statements[1].sql, /^UPDATE users SET tipologie_attivismo/);
  assert.deepEqual(h.logs, []);
});

test('authorized Admin can edit while unknown users produce no write', async () => {
  const admin = harness();
  const ok = await admin.call(OTHER, { id: OWN, isAdmin: true }, ['sport']);
  assert.equal(ok.statusCode, 200);
  assert.equal(admin.statements.length, 2);
  const missing = harness({ exists: false });
  const notFound = await missing.call(OWN, { id: OWN, isAdmin: false });
  assert.equal(notFound.statusCode, 404);
  assert.equal(missing.statements.length, 1);
});

test('malformed or unknown types are rejected without SQL or personal logs', async () => {
  for (const values of [null, [], ['not_a_real_type'], Array(6).fill('sport')]) {
    const h = harness();
    const res = await h.call(OWN, { id: OWN, isAdmin: false }, values);
    assert.equal(res.statusCode, 400);
    assert.equal(h.statements.length, 0);
    assert.deepEqual(h.logs, []);
  }
});
