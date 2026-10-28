'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const authPath = require.resolve(path.join(ROOT, 'middleware/auth.js'));
const validationPath = require.resolve(path.join(ROOT, 'middleware/validation.js'));
const auditPath = require.resolve(path.join(ROOT, 'services/auditService.js'));
const erasurePath = require.resolve(path.join(ROOT, 'services/privacyErasureLedgerService.js'));
const routePath = require.resolve(path.join(ROOT, 'routes/user/gdpr-rights.js'));

async function withGdprRoute({ missing = false, deletionFails = false, zeroDeleted = false, auditFails = false } = {}, fn) {
  const modules = [authPath, validationPath, auditPath, erasurePath, routePath];
  const original = new Map(modules.map(m => [m, require.cache[m]]));
  const operations = [];
  let released = 0;
  const client = {
    async query(sql) {
      const normalized = String(sql).trim().replace(/\s+/g, ' ');
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) {
        operations.push(normalized);
        return { rows: [], rowCount: 0 };
      }
      if (normalized.startsWith('SELECT id FROM users WHERE id::text')) {
        operations.push('LOCK');
        return { rows: missing ? [] : [{ id: 'synthetic-1' }] };
      }
      if (normalized.startsWith('INSERT INTO user_rights_requests')) {
        operations.push('RECEIPT');
        return { rows: [{ id: 'synthetic-receipt' }], rowCount: 1 };
      }
      if (normalized.startsWith('UPDATE user_rights_requests')) {
        operations.push('RECEIPT_COMPLETE');
        return { rows: [], rowCount: 1 };
      }
      throw new Error('Unexpected SQL statement in test');
    },
    release() { released++; operations.push('RELEASE'); }
  };
  const pool = {
    async connect() { operations.push('CONNECT'); return client; },
    async query() { throw new Error('Non-atomic pool.query was called'); }
  };
  const mock = (key, exports) => { require.cache[key] = { id: key, filename: key, loaded: true, exports }; };
  mock(authPath, {
    pool,
    verifyToken(req, _res, next) { req.userId = 'synthetic-1'; req.user = { id: req.userId }; next(); }
  });
  mock(validationPath, {
    validateInput: () => (_req, _res, next) => next()
  });
  mock(auditPath, {
    async logAction() {
      operations.push('AUDIT');
      if (auditFails) throw new Error('external audit unavailable');
    }
  });
  mock(erasurePath, {
    EVENT_TYPES: { ACCOUNT_DELETED: 'account_deleted' },
    async recordEvent(db, event) {
      assert.strictEqual(db, client);
      assert.equal(event.eventType, 'account_deleted');
      operations.push('LEDGER');
    },
    async deleteByAnyColumn(db) {
      assert.strictEqual(db, client);
      operations.push('AUDIT_DELETE');
    },
    async enforceAccountDeletion(db) {
      assert.strictEqual(db, client);
      operations.push('ERASE');
      if (deletionFails) throw new Error('synthetic deletion failure');
      return { userDeleted: zeroDeleted ? 0 : 1, dependentDeleted: 0, rowsUnlinked: 0 };
    }
  });
  delete require.cache[routePath];
  let server;
  try {
    const app = express();
    app.use(express.json());
    app.use('/api/user', require(routePath));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port;
    await fn({ url, operations, getReleased: () => released });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const [k, v] of original) {
      if (v) require.cache[k] = v;
      else delete require.cache[k];
    }
  }
}
async function erase(url, confirmation = 'CONFERMO_CANCELLAZIONE_ACCOUNT') {
  return fetch(url + '/api/user/account', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirmation })
  });
}
test('GDPR delete commits receipt and canonical erasure on the same checked-out client', async () => {
  await withGdprRoute({}, async ({ url, operations, getReleased }) => {
    const r = await erase(url);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).success, true);
    assert.deepEqual(operations, [
      'CONNECT', 'BEGIN', 'LOCK', 'RECEIPT', 'LEDGER', 'AUDIT_DELETE',
      'ERASE', 'RECEIPT_COMPLETE', 'COMMIT', 'RELEASE', 'AUDIT'
    ]);
    assert.equal(getReleased(), 1);
  });
});
test('no confirmation returns 400 without acquiring a connection', async () => {
  await withGdprRoute({}, async ({ url, operations }) => {
    assert.equal((await erase(url, 'INVALID')).status, 400);
    assert.deepEqual(operations, []);
  });
});
test('missing account returns 404, rolls back and does not create erasure ledger', async () => {
  await withGdprRoute({ missing: true }, async ({ url, operations, getReleased }) => {
    assert.equal((await erase(url)).status, 404);
    assert.deepEqual(operations, ['CONNECT', 'BEGIN', 'LOCK', 'ROLLBACK', 'RELEASE']);
    assert.equal(getReleased(), 1);
  });
});
test('cleanup error rolls back receipt and deletion atomically', async () => {
  await withGdprRoute({ deletionFails: true }, async ({ url, operations, getReleased }) => {
    assert.equal((await erase(url)).status, 500);
    assert.ok(operations.indexOf('ROLLBACK') > operations.indexOf('ERASE'));
    assert.ok(!operations.includes('COMMIT'));
    assert.ok(!operations.includes('RECEIPT_COMPLETE'));
    assert.equal(getReleased(), 1);
  });
});
test('zero deleted accounts fail closed and roll back', async () => {
  await withGdprRoute({ zeroDeleted: true }, async ({ url, operations }) => {
    assert.equal((await erase(url)).status, 500);
    assert.ok(operations.includes('ROLLBACK'));
    assert.ok(!operations.includes('COMMIT'));
  });
});
test('post-commit audit outage does not falsely report failure to erase', async () => {
  await withGdprRoute({ auditFails: true }, async ({ url, operations }) => {
    assert.equal((await erase(url)).status, 200);
    assert.ok(operations.indexOf('COMMIT') < operations.indexOf('AUDIT'));
    assert.equal(operations.filter(x => x === 'COMMIT').length, 1);
  });
});
