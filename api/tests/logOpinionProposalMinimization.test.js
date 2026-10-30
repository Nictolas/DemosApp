'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/opinioni-proposte.js'), 'utf8');

function makeRoute(query) {
  const routes = [];
  const logs = [];
  const router = {};
  for (const method of ['get', 'post', 'delete']) {
    router[method] = (routePath, ...handlers) => {
      routes.push({ method, routePath, handler: handlers.at(-1) });
    };
  }
  const pool = { query };
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === '../middleware/auth') return { verifyToken() {}, requireAdmin() {} };
      if (name === '../middleware/politicalConsent') return { requirePoliticalConsent() {} };
      if (name === '../middleware/civicIdentity') return { requireVerifiedCivicIdentity() {} };
      if (name === '../config/database') return { getPool: () => pool };
      throw new Error('Unexpected module ' + name);
    },
    console: {
      log: (...args) => logs.push(args.join(' ')),
      error: (...args) => logs.push(args.join(' ')),
      warn: (...args) => logs.push(args.join(' '))
    },
    process: { env: {} },
    setTimeout
  }, { filename: 'opinioni-proposte.js' });
  const handler = routes.find(r => r.method === 'delete' && r.routePath === '/:id/vota')?.handler;
  assert.equal(typeof handler, 'function');
  return { handler, logs };
}

function response() {
  return {
    code: 200,
    payload: null,
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

test('proposal endpoints do not log personal payloads or return raw exception details', () => {
  assert.doesNotMatch(source, /console\.(?:log|warn)\s*\(/);
  assert.doesNotMatch(source, /message:\s*error\.message|error:\s*error\.message|details:\s*error\.stack/);
  assert.doesNotMatch(source, /console\.error\((?!'\[opinion-proposals\] failure'\))/);
});

test('vote removal has no diagnostic SELECT of a citizen vote history', () => {
  const start = source.indexOf("router.delete('/:id/vota'");
  const end = source.indexOf("router.delete('/:id'", start + 1);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /SELECT\s+\*\s+FROM\s+voti_opinioni_proposte/i);
  assert.doesNotMatch(block, /SELECT\s+opinione_id\s*,\s*utente_id\s+FROM\s+voti_opinioni_proposte/i);
  assert.match(block, /DELETE FROM voti_opinioni_proposte/);
});

test('vote removal still deletes a vote without logging user or proposal identifiers', async () => {
  const statements = [];
  const { handler, logs } = makeRoute(async sql => {
    statements.push(sql);
    if (sql.includes('to_regclass')) return { rows: [{ relation_name: 'voti_opinioni_proposte' }] };
    if (sql.includes('SELECT id FROM opinioni_proposte')) return { rows: [{ id: 'proposal-private' }] };
    if (sql.includes('DELETE FROM voti_opinioni_proposte')) return { rowCount: 1 };
    throw new Error('Unexpected SQL');
  });
  const res = response();
  await handler({ params: { id: 'proposal-private' }, userId: 'citizen-private' }, res);
  assert.equal(res.code, 200);
  assert.equal(res.payload.success, true);
  assert.equal(statements.filter(sql => sql.includes('DELETE FROM voti_opinioni_proposte')).length, 1);
  assert.equal(statements.filter(sql => /SELECT.*voti_opinioni_proposte/i.test(sql) && !sql.includes('to_regclass')).length, 0);
  assert.doesNotMatch(logs.join(' '), /proposal-private|citizen-private/);
});

test('database failure does not expose exception text to HTTP or logs', async () => {
  const { handler, logs } = makeRoute(async () => { throw new Error('SQL_PRIVATE_PAYLOAD_123'); });
  const res = response();
  await handler({ params: { id: 'proposal-private' }, userId: 'citizen-private' }, res);
  assert.equal(res.code, 500);
  assert.equal(res.payload.success, false);
  assert.doesNotMatch(JSON.stringify(res.payload) + logs.join(' '), /SQL_PRIVATE_PAYLOAD_123|proposal-private|citizen-private/);
});
