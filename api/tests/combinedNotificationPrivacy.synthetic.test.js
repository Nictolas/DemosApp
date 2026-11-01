'use strict';

// Cross-PR gate for PR #525 (inbox-first) + PR #494 (recipient isolation).
// The workflow temporarily overlays #494 files into its disposable runner.
// Fake tokens, users and PostgreSQL: NO real push, credentials or personal data.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const KEY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KEY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const globalRow = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  id_utente: null, titolo: 'Avviso globale', testo: 'Visibile a tutti',
  data_creazione: '2026-10-31T08:00:00Z', data: '2026-10-31'
};
const notices = [globalRow];
const byKey = new Map();
let inserts = 0;

const pool = {
  async query(statement, params = []) {
    const sql = String(statement);
    if (/SELECT id, email, nome, cognome, status FROM users/.test(sql)) {
      if (![A, B].includes(params[0])) return { rows: [] };
      return { rows: [{ id: params[0], email: 'fake@example.invalid',
        nome: 'Persona', cognome: 'Test', status: 'A' }] };
    }
    if (/FROM users WHERE id = \$1/.test(sql)) {
      return { rows: [{ id: params[0], comune_residenza: null,
        rappresentante_camera: null, rappresentante_senato: null, rappresentante_comune: null }] };
    }
    if (sql.includes("WHERE table_name = 'notifiche_demos'")) {
      return { rows: [{ column_name: 'titolo' }, { column_name: 'testo' }] };
    }
    if (/INSERT INTO notifiche_demos/.test(sql)) {
      const [id_utente, titolo, testo, key] = params;
      if (byKey.has(key)) return { rows: [] };
      const id = '00000000-0000-4000-8000-' + String(++inserts).padStart(12, '0');
      const record = { id, id_utente, titolo, testo, data: '2026-11-01',
        data_creazione: new Date(Date.now() + inserts * 1000).toISOString() };
      byKey.set(key, record);
      notices.push(record);
      return { rows: [{ id }] };
    }
    if (/SELECT id, id_utente, titolo, testo FROM notifiche_demos WHERE idempotency_key/.test(sql)) {
      return { rows: byKey.has(params[0]) ? [byKey.get(params[0])] : [] };
    }
    if (/FROM notifiche_demos/.test(sql)) {
      // Make the test fail if PR #494's ownership SQL disappears.
      const guarded = sql.includes('WHERE (id_utente IS NULL OR id_utente = $1::uuid)');
      const allowed = guarded ? notices.filter(n => n.id_utente === null || n.id_utente === params[0]) : notices;
      const sorted = allowed.slice().sort((x, y) => y.data_creazione.localeCompare(x.data_creazione));
      return { rows: sql.includes('LIMIT 1') ? sorted.slice(0, 1) : sorted };
    }
    // Unrelated notification streams have no synthetic fixtures.
    return { rows: [] };
  }
};

const mocked = [
  ['../config/database', { getPool: () => pool }],
  ['../middleware/auth', {
    verifyToken: (req, res, next) => {
      const bearer = req.headers.authorization;
      const userId = bearer === 'Bearer synthetic-admin' ? ADMIN :
        bearer === 'Bearer synthetic-a' ? A :
        bearer === 'Bearer synthetic-b' ? B : null;
      if (!userId) return res.status(401).json({ success: false, error: 'Token richiesto' });
      req.user = { id: userId, isAdmin: userId === ADMIN, role: userId === ADMIN ? 'AD' : 'U' };
      req.userId = userId;
      next();
    },
    requireAdmin: (req, res, next) => req.user?.isAdmin ? next() : res.sendStatus(403),
  }],
  ['../services/accountCapabilitiesService', { getAccountSubject: () => ({}) }],
  ['../services/currentSupporterPushService', { sendPushToCurrentSupporters: async () => ({}) }],
  ['../services/politicalJurisdictionRegistryService', { resolvePoliticalOffice: () => null }],
  ['../services/firebaseAdmin', { getFirebaseAdmin: () => null }],
];
const cache = [];
for (const [modulePath, exports] of mocked) {
  const resolved = require.resolve(modulePath);
  cache.push([resolved, require.cache[resolved]]);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}
const app = express();
app.use(express.json());
app.use('/api/comunicazioni', require('../routes/comunicazioni'));
app.use('/api/notifiche', require('../routes/notifiche'));
const server = app.listen(0, '127.0.0.1');
const ready = new Promise((resolve, reject) => {
  if (server.listening) resolve();
  else server.once('listening', resolve);
  server.once('error', reject);
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  cache.forEach(([id, old]) => {
    delete require.cache[id];
    if (old) require.cache[id] = old;
  });
});
const base = () => 'http://127.0.0.1:' + server.address().port;
async function call(route, who, method = 'GET', body = null) {
  await ready;
  const res = await fetch(base() + route, {
    method,
    headers: {
      ...(who ? { authorization: 'Bearer synthetic-' + who } : {}),
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(4000)
  });
  const raw = await res.text();
  let body;
  try { body = JSON.parse(raw); }
  catch { body = { message: raw }; }
  return { status: res.status, body };
}
function send(who, key, title, message) {
  return call('/api/comunicazioni/send-user-notification', 'admin', 'POST',
    { userId: who, titolo: title, messaggio: message, idempotencyKey: key });
}

test('two synthetic recipients: private inbox and latest isolate #525 writes under #494 reads', async () => {
  assert.equal((await call('/api/notifiche', null)).status, 401);
  assert.equal((await call('/api/notifiche/ultima', null)).status, 401);
  assert.equal((await call('/api/comunicazioni/send-user-notification', 'a', 'POST',
    { userId: A, titolo: 'Spoof', messaggio: 'Non autorizzato', idempotencyKey: KEY_A })).status, 403);

  const first = await send(A, KEY_A, 'Messaggio personale', 'Segreto A senza FCM');
  assert.equal(first.status, 200);
  assert.equal(first.body.data.inbox_salvata, true);
  assert.equal(first.body.data.push_inviato, false);

  const retry = await send(A, KEY_A, 'Messaggio personale', 'Segreto A senza FCM');
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.id_notifica, first.body.data.id_notifica);
  assert.equal(retry.body.data.duplicata_evitata, true);
  assert.equal(inserts, 1);

  for (const path of ['/api/notifiche', '/api/notifiche/ultima']) {
    const forA = await call(path, 'a');
    const forB = await call(path, 'b');
    assert.equal(forA.status, 200);
    assert.equal(forB.status, 200);
    assert.ok(JSON.stringify(forA.body).includes('Segreto A senza FCM'), path + ': recipient A must see own inbox');
    assert.ok(!JSON.stringify(forB.body).includes('Segreto A senza FCM'), path + ': recipient B must not see A');
  }

  const second = await send(B, KEY_B, 'DEMOS — Privato B', 'Segreto B senza FCM');
  assert.equal(second.status, 200);
  assert.equal(second.body.data.inbox_salvata, true);
  assert.equal(second.body.data.push_inviato, false);
  assert.equal(inserts, 2);

  for (const path of ['/api/notifiche', '/api/notifiche/ultima']) {
    const forA = await call(path, 'a');
    const forB = await call(path, 'b');
    assert.ok(!JSON.stringify(forA.body).includes('Segreto B senza FCM'), path + ': A must not see B');
    assert.ok(JSON.stringify(forB.body).includes('Segreto B senza FCM'), path + ': B must see B');
  }

  const conflict = await send(A, KEY_A, 'Titolo diverso', 'Segreto diverso');
  assert.equal(conflict.status, 409);
  assert.equal(inserts, 2, 'conflicting key must not insert');
  const visibleA = await call('/api/notifiche', 'a');
  const visibleB = await call('/api/notifiche', 'b');
  assert.ok(JSON.stringify(visibleA.body).includes('Visibile a tutti'), 'public notice remains visible');
  assert.ok(JSON.stringify(visibleB.body).includes('Visibile a tutti'), 'public notice remains visible');
});
