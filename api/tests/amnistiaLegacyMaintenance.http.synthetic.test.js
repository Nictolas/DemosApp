'use strict';
// Real Express routing, synthetic-only identity and zero database/provider calls.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

let sqlCalls = 0;
const pool = {
  async query() { sqlCalls++; throw Error('REAL_SQL_FORBIDDEN'); },
  async connect() { sqlCalls++; throw Error('REAL_SQL_FORBIDDEN'); }
};
const pathFor = name => require.resolve(name);
function stub(name, exports) {
  const filename = pathFor(name);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (token !== 'Bearer admin' && token !== 'Bearer user') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  req.userId = 'synthetic-' + token.split(' ')[1];
  req.user = { id: req.userId, isAdmin: token === 'Bearer admin' };
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) return res.status(403).json({ success: false });
  next();
};
const noop = (_req, _res, next) => next();
stub('../middleware/auth', { verifyToken, requireAdmin, pool });
stub('../middleware/politicalConsent', { requirePoliticalConsent: noop });
stub('../middleware/civicIdentity', { requireVerifiedCivicIdentity: noop });
stub('../middleware/validation', { validateInput: () => noop });
stub('../services/preferenceCooldownService', {
  getPreferenceCooldown: async () => ({ isBlocked: false }),
  assertPreferenceChangeAllowed: async () => {},
  recordPreferenceChange: async () => {},
  sendCooldownError: () => false
});
const app = express();
app.use(express.json());
app.use('/api/amnistia', require('../routes/amnistia'));
const server = http.createServer(app);
let base;
async function request(method, route, token) {
  if (!base) {
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  return fetch(base + route, {
    method,
    headers: token ? { authorization: 'Bearer ' + token } : {}
  });
}
after(async () => {
  if (server.listening) await new Promise(done => server.close(done));
});
const retired = [
  ['POST', '/api/amnistia/migrate'],
  ['POST', '/api/amnistia/migrate-ids'],
  ['POST', '/api/amnistia/fix-primary-key'],
  ['GET', '/api/amnistia/test'],
  ['GET', '/api/amnistia/debug']
];
test('five maintenance routes require Admin, fail closed, never query SQL or emit schema', async () => {
  for (const [method, route] of retired) {
    assert.equal((await request(method, route, null)).status, 401, route + ' anonymous');
    assert.equal((await request(method, route, 'user')).status, 403, route + ' non-admin');
    const res = await request(method, route, 'admin');
    assert.equal(res.status, 410, route + ' admin');
    assert.match(res.headers.get('cache-control') || '', /private/);
    assert.match(res.headers.get('cache-control') || '', /no-store/);
    const result = await res.json();
    assert.equal(result.code, 'AMNISTIA_MAINTENANCE_RETIRED');
    assert.equal(result.success, false);
    assert.doesNotMatch(JSON.stringify(result), /table|column|stack|password|secret|sqlstate/i);
  }
  assert.equal(sqlCalls, 0, 'blocked routes must never access SQL or open a transaction');
});

test('ordinary authenticated proposal remains moderation-blocked and does not touch SQL', async () => {
  const res = await request('POST', '/api/amnistia', 'user');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'MODERATION_REQUIRED');
  assert.equal(sqlCalls, 0);
});

test('retired migrations cannot be restored by reintroducing DDL in an HTTP handler', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/amnistia.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\b/i);
  assert.doesNotMatch(source, /details:\s*error\.message|error:\s*error\.message/);
  for (const [method, route] of retired) {
    const action = route.split('/').pop();
    const pattern = new RegExp("router\\." + (method === 'GET' ? 'get' : 'post') +
      "\\('/" + action + "', verifyToken, requireAdmin, retiredAmnestyMaintenance\\)");
    assert.match(source, pattern);
  }
});
