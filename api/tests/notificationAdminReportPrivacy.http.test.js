'use strict';

// Actual Express admin report deletion route, synthetic identities and database.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const ADMIN = '33333333-3333-4333-8333-333333333333';
const ID = '44444444-4444-4444-8444-444444444444';
const calls = [];
let failWrite = false;
let exists = true;

const db = {
  async query(sql, args = []) {
    calls.push({ sql: String(sql), args });
    if (failWrite) throw new Error('RAW_SECRET_DB_ERROR_NEVER_PUBLIC');
    if (!String(sql).includes('DELETE FROM segnalazioni WHERE id = $1')) {
      throw new Error('Unexpected SQL');
    }
    assert.deepEqual(args, [ID]);
    const count = exists ? 1 : 0;
    exists = false;
    return { rowCount: count };
  },
};
const dbModuleId = require.resolve('../config/database');
const authModuleId = require.resolve('../middleware/auth');
const reportModuleId = require.resolve('../routes/segnalazioni');
const oldEntries = [dbModuleId, authModuleId, reportModuleId]
  .map(id => [id, require.cache[id]]);
require.cache[dbModuleId] = {
  id: dbModuleId, filename: dbModuleId, loaded: true,
  exports: { getPool: () => db }
};
require.cache[authModuleId] = {
  id: authModuleId, filename: authModuleId, loaded: true,
  exports: {
    verifyToken(req, res, next) {
      const token = req.headers.authorization;
      if (token !== 'Bearer admin' && token !== 'Bearer ordinary') {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      req.user = { id: token === 'Bearer admin' ? ADMIN : '55555555-5555-4555-8555-555555555555',
        isAdmin: token === 'Bearer admin' };
      next();
    },
    requireAdmin(req, res, next) {
      if (!req.user?.isAdmin) return res.status(403).json({ success: false, error: 'Forbidden' });
      next();
    },
  }
};
delete require.cache[reportModuleId];
const app = express();
app.use(express.json());
app.use('/api/segnalazioni', require('../routes/segnalazioni'));
let server;
async function remove(token = 'admin') {
  if (!server) {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  }
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: server.address().port,
      method: 'DELETE', path: '/api/segnalazioni/' + ID,
      headers: { authorization: 'Bearer ' + token }
    }, res => {
      const pieces = [];
      res.on('data', chunk => pieces.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(pieces).toString('utf8');
        try { resolve({ status: res.statusCode, data: JSON.parse(body), body }); }
        catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [id, entry] of oldEntries) {
    if (entry) require.cache[id] = entry;
    else delete require.cache[id];
  }
});

test('anonymous and ordinary accounts cannot delete reports or reach SQL', async () => {
  calls.length = 0;
  assert.equal((await remove('invalid')).status, 401);
  assert.equal((await remove('ordinary')).status, 403);
  assert.equal(calls.length, 0);
});

test('authorized report delete uses only path report ID, not user_id query', async () => {
  calls.length = 0;
  exists = true;
  const res = await remove();
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, [ID]);
  assert.equal((await remove()).status, 404);
});

test('database exception returns generic 500 without leaking SQL or account IDs', async () => {
  failWrite = true;
  const res = await remove();
  failWrite = false;
  assert.equal(res.status, 500);
  assert.equal(res.data.error, 'Errore interno del server');
  assert.doesNotMatch(res.body, /RAW_SECRET_DB_ERROR_NEVER_PUBLIC|33333333-|DELETE FROM|44444444-/);
});

test('admin report logging omits identifiers, raw error objects and stacks', () => {
  const code = fs.readFileSync(path.resolve(__dirname, '../routes/segnalazioni.js'), 'utf8');
  assert.doesNotMatch(code, /console\.(?:log|warn|error)\([^\n]*(?:req\.user\.id|segnalazioneId|,\s*error\s*\))/);
  assert.doesNotMatch(code, /console\.(?:log|error)\(`[^\n]*\$\{id\}/);
  const page = fs.readFileSync(path.resolve(__dirname,
    '../../client/src/pages/Notifiche/hooks/useNotificheData.ts'), 'utf8');
  assert.match(page, /apiRequest\("DELETE", `\/api\/segnalazioni\/\$\{segnalazioneId\}`\)/);
  assert.doesNotMatch(page, /segnalazioneId\}\?user_id/);
});
