'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routeSource = fs.readFileSync(
  path.join(__dirname, '../routes/user/delete-account.js'), 'utf8'
);

function makeHarness({ deletionError = null, auditErrorOn = null, rollbackError = null, requirementsError = null } = {}) {
  const routes = {};
  const queries = [];
  const audits = [];
  const operationalErrors = [];
  let releases = 0;
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql === 'ROLLBACK' && rollbackError) throw rollbackError;
      if (sql.includes('SELECT password_hash')) return { rows: [{ password_hash: null }] };
      return { rows: [] };
    },
    release() { releases++; }
  };
  const pool = {
    async connect() { return client; },
    async query() {
      if (requirementsError) throw requirementsError;
      return { rows: [{ password_hash: null }] };
    }
  };
  const ledger = {
    EVENT_TYPES: { ACCOUNT_DELETED: 'ACCOUNT_DELETED' },
    async recordEvent() {},
    async deleteByAnyColumn() {},
    async enforceAccountDeletion() { if (deletionError) throw deletionError; }
  };
  const auditService = {
    async logAction(event) {
      audits.push(event);
      if (event.action === auditErrorOn) throw new Error('audit transport: PRIVATE_EMAIL@example.test');
      return { id: 'synthetic-audit' };
    }
  };
  const fakeRouter = {
    get(url, ...handlers) { routes['GET ' + url] = handlers.at(-1); },
    delete(url, ...handlers) { routes['DELETE ' + url] = handlers.at(-1); }
  };
  const dependencies = {
    express: { Router: () => fakeRouter },
    '../../middleware/auth': { verifyToken: (_req, _res, next) => next?.() },
    '../../services/auditService': auditService,
    '../../config/database': { getPool: () => pool },
    bcryptjs: { compare: async () => true },
    '../../services/privacyErasureLedgerService': ledger
  };
  vm.runInNewContext(routeSource, {
    module: { exports: {} },
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error('Unexpected dependency: ' + name);
      return dependencies[name];
    },
    console: { error: (...args) => operationalErrors.push(args), log() {} },
    process: { env: { AXIOM_ENABLED: 'true' } },
    Date
  }, { filename: 'delete-account.js' });

  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = { user: { id: 'synthetic-user-123' }, body: { confirmText: 'CANCELLA' } };
  return {
    async deleteAccount() { await routes['DELETE /'](req, response); },
    async requirements() { await routes['GET /requirements'](req, response); },
    queries, audits, operationalErrors, response, req,
    get releases() { return releases; }
  };
}

test('successful DELETE stays successful if completion audit delivery throws after COMMIT', async () => {
  const h = makeHarness({ auditErrorOn: 'ACCOUNT_DELETION_COMPLETED' });
  await h.deleteAccount();
  assert.equal(h.response.statusCode, 200);
  assert.equal(h.response.body.success, true);
  assert.equal(h.queries.filter(x => x === 'COMMIT').length, 1);
  assert.equal(h.queries.filter(x => x === 'ROLLBACK').length, 0);
  assert.equal(h.releases, 1);
  const completion = h.audits.find(x => x.action === 'ACCOUNT_DELETION_COMPLETED');
  assert.equal(completion.userId, null);
  assert.equal(JSON.stringify(completion).includes('synthetic-user-123'), false);
  assert.deepEqual(h.operationalErrors, [['ACCOUNT_DELETION_COMPLETION_AUDIT_FAILED']]);
});

test('failed start audit delivery cannot block account erasure', async () => {
  const h = makeHarness({ auditErrorOn: 'ACCOUNT_DELETION_STARTED' });
  await h.deleteAccount();
  assert.equal(h.response.statusCode, 200);
  assert.equal(h.response.body.success, true);
  assert.equal(h.queries.filter(x => x === 'COMMIT').length, 1);
  assert.equal(h.queries.filter(x => x === 'ROLLBACK').length, 0);
  assert.deepEqual(h.operationalErrors, [['ACCOUNT_DELETION_START_AUDIT_FAILED']]);
});

test('failed DELETE rolls back and never exposes exception details in audit or operational logs', async () => {
  const h = makeHarness({ deletionError: new Error('PRIVATE_EMAIL@example.test SQL select secret') });
  await h.deleteAccount();
  assert.equal(h.response.statusCode, 500);
  assert.equal(h.response.body.success, false);
  assert.equal(h.queries.filter(x => x === 'COMMIT').length, 0);
  assert.equal(h.queries.filter(x => x === 'ROLLBACK').length, 1);
  assert.equal(h.releases, 1);
  const event = h.audits.find(x => x.action === 'ACCOUNT_DELETION_ERROR');
  assert.equal(event.success, false);
  assert.equal(event.errorMessage, 'ACCOUNT_DELETION_FAILED');
  assert.equal(JSON.stringify(event).includes('PRIVATE_EMAIL@example.test'), false);
  assert.equal(JSON.stringify(h.operationalErrors).includes('PRIVATE_EMAIL@example.test'), false);
});

test('rollback and error-audit failures do not leak SQL exceptions or prevent 500 response', async () => {
  const h = makeHarness({
    deletionError: new Error('PRIVATE_EMAIL@example.test'),
    rollbackError: new Error('PRIVATE_EMAIL@example.test'),
    auditErrorOn: 'ACCOUNT_DELETION_ERROR'
  });
  await h.deleteAccount();
  assert.equal(h.response.statusCode, 500);
  assert.equal(h.releases, 1);
  assert.deepEqual(h.operationalErrors.map(x => x[0]), [
    'ACCOUNT_DELETION_ROLLBACK_FAILED',
    'ACCOUNT_DELETION_FAILED',
    'ACCOUNT_DELETION_ERROR_AUDIT_FAILED'
  ]);
});

test('requirements failure returns generic HTTP 500 without logging database exception', async () => {
  const h = makeHarness({ requirementsError: new Error('PRIVATE_EMAIL@example.test') });
  await h.requirements();
  assert.equal(h.response.statusCode, 500);
  assert.equal(JSON.stringify(h.operationalErrors).includes('PRIVATE_EMAIL@example.test'), false);
  assert.deepEqual(h.operationalErrors, [['ACCOUNT_DELETION_REQUIREMENTS_FAILED']]);
});
