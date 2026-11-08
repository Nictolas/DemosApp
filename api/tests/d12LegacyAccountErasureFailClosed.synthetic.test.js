'use strict';
// No live accounts, database, emails or app server required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../routes/user/gdpr-rights.js'), 'utf8');
const handlers = new Map();
let sqlCalls = 0;
const db = { query: () => { sqlCalls++; throw new Error('legacy erasure must not execute SQL'); } };
const verifyToken = (_req, _res, next) => next();
const router = {
  use: fn => handlers.set('auth', fn),
  get: (url, ...fns) => handlers.set('GET ' + url, fns.at(-1)),
  post: (url, ...fns) => handlers.set('POST ' + url, fns.at(-1)),
  put: (url, ...fns) => handlers.set('PUT ' + url, fns.at(-1)),
  delete: (url, ...fns) => handlers.set('DELETE ' + url, fns.at(-1)),
};

vm.runInNewContext(code, {
  module: { exports: {} },
  require: name => {
    if (name === 'express') return { Router: () => router };
    if (name === '../../middleware/auth') return { verifyToken, pool: db };
    if (name === '../../middleware/validation') return { validateInput: () => (_req, _res, next) => next() };
    if (name === '../../services/auditService') return { logAction: () => { throw new Error('legacy erasure must not audit a fake deletion'); } };
    if (name === '../../utils/emailCrypto') return { decrypt: () => null };
    if (name === 'crypto') return require('node:crypto');
    throw new Error('Unknown module: ' + name);
  },
  Buffer, console, process,
}, { filename: 'gdpr-rights.js' });

function makeResponse() {
  return {
    code: 200, headers: {}, body: null,
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('deprecated account erasure fails closed without SQL, log or false deletion receipt', async () => {
  assert.equal(handlers.get('auth'), verifyToken, 'GDPR rights router must remain authenticated');
  const handler = handlers.get('DELETE /account');
  assert.equal(typeof handler, 'function');
  const req = { userId: '11111111-1111-4111-8111-111111111111',
    body: { confirmation: 'CONFERMO_CANCELLAZIONE_ACCOUNT', detail: 'SENSITIVE_SENTINEL' } };
  const res = makeResponse();
  await handler(req, res);
  assert.equal(res.code, 410);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'LEGACY_ACCOUNT_ERASURE_DISABLED');
  assert.equal(res.body.replacement, '/api/user/delete-account');
  assert.match(res.headers['cache-control'], /no-store/);
  assert.equal(sqlCalls, 0);
  assert.ok(!JSON.stringify(res.body).includes('SENSITIVE_SENTINEL'));
  assert.ok(!JSON.stringify(res.body).includes(req.userId));
});

test('supported UI continues using canonical account deletion with typed confirmation', () => {
  const client = fs.readFileSync(path.join(__dirname,
    '../../client/src/pages/Impostazioni/CancellaAccount/index.tsx'), 'utf8');
  const canonical = fs.readFileSync(path.join(__dirname, '../routes/user/delete-account.js'), 'utf8');
  assert.match(client, /apiRequest\("DELETE", "\/api\/user\/delete-account"/);
  assert.match(canonical, /PrivacyErasureLedgerService\.enforceAccountDeletion/);
  assert.match(canonical, /confirmText !== 'CANCELLA'/);
});
