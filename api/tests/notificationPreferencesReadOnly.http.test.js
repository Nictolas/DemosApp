'use strict';

// HTTP integration of the actual notification routes with synthetic user IDs.
// The DB pool and token authentication are isolated; no Render/Supabase/FCM I/O.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const fakeRows = new Map();
const sqlCalls = [];
let failRead = false;
const pool = {
  async query(text, args = []) {
    const sql = String(text);
    sqlCalls.push({ sql, args });
    if (failRead) throw new Error('PRIVATE_DATABASE_HOST_DO_NOT_LEAK');
    if (/^SELECT eurodeputato, senatore/.test(sql.trim()) && /FROM notifiche_preferenze/.test(sql)) {
      return { rows: fakeRows.has(args[0]) ? [{ ...fakeRows.get(args[0]) }] : [] };
    }
    if (/^INSERT INTO notifiche_preferenze/.test(sql.trim())) {
      const keys = ['eurodeputato', 'senatore', 'deputato', 'consigliere_regionale',
        'consigliere_comunale', 'attivisti', 'demos', 'scuola', 'animali', 'organizzazioni'];
      const row = Object.fromEntries(keys.map((k, i) => [k, args[i + 1]]));
      row.user_id = args[0];
      row.updated_at = '2026-11-02T00:00:00.000Z';
      fakeRows.set(args[0], row);
      return { rows: [{ ...row }] };
    }
    throw new Error('Unexpected test SQL: ' + sql.slice(0, 50));
  }
};

const dbId = require.resolve('../config/database');
const authId = require.resolve('../middleware/auth');
const routerId = require.resolve('../routes/notifiche');
const originalModules = [dbId, authId, routerId].map(id => [id, require.cache[id]]);
require.cache[dbId] = { id: dbId, filename: dbId, loaded: true, exports: { getPool: () => pool } };
require.cache[authId] = { id: authId, filename: authId, loaded: true, exports: {
  verifyToken(req, res, next) {
    const bearer = req.headers.authorization;
    const id = bearer === 'Bearer test-a' ? USER_A : bearer === 'Bearer test-b' ? USER_B : null;
    if (!id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    req.user = { id, isAdmin: false };
    next();
  },
  requireAdmin: (_req, res) => res.sendStatus(403)
} };
delete require.cache[routerId];
const app = express();
app.use(express.json());
app.use('/api/notifiche', require('../routes/notifiche'));
let server;
async function request(path, token = 'test-a', method = 'GET', body) {
  if (!server) {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  }
  const headers = { authorization: 'Bearer ' + token };
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload !== undefined) headers['content-type'] = 'application/json';
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: server.address().port,
      path, method, headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: response.statusCode, headers: response.headers, data: JSON.parse(text), text }); }
        catch (error) { reject(error); }
      });
    });
    r.on('error', reject);
    if (payload !== undefined) r.write(payload);
    r.end();
  });
}
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [id, entry] of originalModules) {
    if (entry) require.cache[id] = entry;
    else delete require.cache[id];
  }
});

test('no preferences row: repeated GET returns legacy defaults and never writes', async () => {
  sqlCalls.length = 0;
  for (let i = 0; i < 4; i++) {
    const reply = await request('/api/notifiche/preferenze');
    assert.equal(reply.status, 200);
    assert.equal(reply.headers['cache-control'], 'no-store');
    assert.equal(reply.data.data.user_id, USER_A);
    assert.equal(reply.data.data.updated_at, null);
    assert.deepEqual(reply.data.data.preferenze, {
      eurodeputato: false, senatore: false, deputato: false,
      consigliere_regionale: false, consigliere_comunale: false,
      attivisti: false, demos: false, scuola: false,
      animali: true, organizzazioni: false
    });
  }
  assert.equal(sqlCalls.length, 4, 'one SELECT per GET and zero INSERT/UPDATE');
  assert.ok(sqlCalls.every(x => /^SELECT/.test(x.sql.trim())));
  assert.ok(!fakeRows.has(USER_A), 'GET must not materialize a new row');
});

test('existing preferences preserve true/false, fall back only for NULL and isolate identities', async () => {
  fakeRows.set(USER_A, { eurodeputato: true, animali: false,
    demos: null, updated_at: '2026-11-01T01:00:00.000Z' });
  const a = await request('/api/notifiche/preferenze', 'test-a');
  const b = await request('/api/notifiche/preferenze', 'test-b');
  assert.equal(a.data.data.preferenze.eurodeputato, true);
  assert.equal(a.data.data.preferenze.animali, false);
  assert.equal(a.data.data.preferenze.demos, false);
  assert.equal(a.data.data.updated_at, '2026-11-01T01:00:00.000Z');
  assert.equal(b.data.data.preferenze.eurodeputato, false);
  assert.equal(b.data.data.preferenze.animali, true);
  assert.equal(b.data.data.updated_at, null);
  assert.ok(!fakeRows.has(USER_B));
});

test('POST remains the sole persistence operation; subsequent GET sees the updated choices', async () => {
  sqlCalls.length = 0;
  const preferences = { eurodeputato: true, animali: false, scuola: true };
  const saved = await request('/api/notifiche/preferenze', 'test-b', 'POST', { preferenze: preferences });
  assert.equal(saved.status, 200);
  const loaded = await request('/api/notifiche/preferenze', 'test-b');
  assert.equal(loaded.status, 200);
  assert.equal(loaded.data.data.preferenze.eurodeputato, true);
  assert.equal(loaded.data.data.preferenze.animali, false);
  assert.equal(loaded.data.data.preferenze.scuola, true);
  assert.equal(sqlCalls.filter(x => /^INSERT/.test(x.sql.trim())).length, 1);
  assert.equal(sqlCalls.filter(x => /^SELECT/.test(x.sql.trim())).length, 1);
});

test('missing/invalid authorization is 401 and cannot access the database', async () => {
  sqlCalls.length = 0;
  const response = await request('/api/notifiche/preferenze', 'bad-token');
  assert.equal(response.status, 401);
  assert.equal(sqlCalls.length, 0);
});

test('database errors return 500 without leaking diagnostic details or SQL', async () => {
  failRead = true;
  const response = await request('/api/notifiche/preferenze');
  failRead = false;
  assert.equal(response.status, 500);
  assert.equal(response.data.error, 'Errore interno del server');
  assert.doesNotMatch(response.text, /PRIVATE_DATABASE_HOST_DO_NOT_LEAK|SELECT eurodeputato/);
});

test('source GET contains no SQL mutations and no raw user preference logging', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/notifiche.js'), 'utf8');
  const start = source.indexOf("// GET /api/notifiche/preferenze");
  const end = source.indexOf("// POST /api/notifiche/preferenze", start);
  assert.ok(start > 0 && end > start);
  const getter = source.slice(start, end);
  assert.doesNotMatch(getter, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE)\s+INTO\b|INSERT\s+INTO|UPDATE\s+notifiche_preferenze/);
  assert.doesNotMatch(getter, /error\.message|console\.log\([^\n]*user_id/);
});

test('notifications feed uses one authorized data query instead of schema introspection', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/notifiche.js'), 'utf8');
  const from = source.indexOf('// Recupera da notifiche_demos senza interrogare information_schema');
  const to = source.indexOf('// Cambi di Opinione di Politici/Candidati', from);
  assert.ok(from > 0 && to > from, 'notification Demos data query present');
  const block = source.slice(from, to);
  assert.ok(!block.includes('information_schema.columns'), 'no information_schema query per feed GET');
  assert.ok(block.includes('WHERE (id_utente IS NULL OR id_utente = $1::uuid)'), 'only global or authenticated-user notices');
  assert.match(block, /LIMIT 50/);
  assert.match(block, /demosResult = \\{ rows: \\[\\] \\};/);
});
