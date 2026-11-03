'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

async function withSyntheticInbox({ tokens = [], firebase = true, pushFails = false, saveFails = false }, run) {
  const dependencies = {
    '../config/database': null,
    '../middleware/auth': null,
    '../services/accountCapabilitiesService': null,
    '../services/currentSupporterPushService': null,
    '../services/politicalJurisdictionRegistryService': null,
    '../services/firebaseAdmin': null,
    '../routes/comunicazioni': null
  };
  const names = Object.keys(dependencies).map(name => require.resolve(name));
  const original = names.map(name => require.cache[name]);
  const previousNodeEnv = process.env.NODE_ENV;
  let server;
  const events = [];
  let saved = 0;
  let sends = 0;
  const savedByKey = new Map();
  const fakePool = {
    async query(sql, params) {
      if (/SELECT id, email, nome, cognome, status FROM users/.test(sql)) {
        return { rows: [{ id: 'user-synthetic', email: 'fake@example.invalid', nome: 'Test', cognome: 'User', status: 'A' }] };
      }
      if (/INSERT INTO notifiche_demos/.test(sql)) {
        events.push('save');
        if (saveFails) throw new Error('synthetic_db_failure');
        assert.equal(params[0], 'user-synthetic');
        const key = params[3];
        assert.match(key, /^[0-9a-f-]{36}$/);
        if (savedByKey.has(key)) return { rows: [] };
        saved++;
        const record = { id: 'notification-synthetic-' + saved, id_utente: params[0], titolo: params[1], testo: params[2] };
        savedByKey.set(key, record);
        return { rows: [{ id: record.id }] };
      }
      if (/SELECT id, id_utente, titolo, testo FROM notifiche_demos WHERE idempotency_key/.test(sql)) {
        return { rows: savedByKey.has(params[0]) ? [savedByKey.get(params[0])] : [] };
      }
      if (/SELECT DISTINCT d.fcm_token/.test(sql)) return { rows: tokens.map(fcm_token => ({ fcm_token })) };
      if (/SELECT COALESCE\(fcm_tokens/.test(sql)) return { rows: [{ fcm_tokens: [] }] };
      throw new Error('Unexpected synthetic SQL: ' + sql.slice(0, 100));
    }
  };
  const mocks = [
    { getPool: () => fakePool },
    {
      verifyToken: (_req, _res, next) => next(),
      requireAdmin: (_req, _res, next) => next()
    },
    { getAccountSubject: () => ({}) },
    { sendPushToCurrentSupporters: async () => ({}) },
    { resolvePoliticalOffice: () => null },
    {
      getFirebaseAdmin: () => firebase ? ({
        messaging: () => ({
          async send() {
            events.push('push');
            sends++;
            if (pushFails) throw Object.assign(new Error('synthetic_failure'), { code: 'messaging/internal-error' });
            return 'fake-message-id';
          }
        })
      }) : null
    },
    null
  ];
  try {
    process.env.NODE_ENV = 'production';
    for (let i = 0; i < names.length - 1; i++) {
      require.cache[names[i]] = {
        id: names[i], filename: names[i], loaded: true, exports: mocks[i]
      };
    }
    delete require.cache[names[names.length - 1]];
    const app = express();
    app.use(express.json());
    app.use('/api/comunicazioni', require('../routes/comunicazioni'));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const url = 'http://127.0.0.1:' + server.address().port + '/api/comunicazioni/send-user-notification';
    const request = async (overrides = {}) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-synthetic', titolo: 'Titolo sintetico',
          messaggio: 'Testo sintetico',
          idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ...overrides
        }),
        signal: AbortSignal.timeout(3000)
      });
      return { status: response.status, body: await response.json() };
    };
    await run({ request, events, getSaved: () => saved, getSends: () => sends });
  } finally {
    if (server) {
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
    names.forEach((name, i) => {
      delete require.cache[name];
      if (original[i]) require.cache[name] = original[i];
    });
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}

test('no FCM token: in-app notification persists and push is truthfully unavailable', async () => {
  await withSyntheticInbox({ tokens: [] }, async ({ request, events, getSaved, getSends }) => {
    const result = await request();
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.data.inbox_salvata, true);
    assert.equal(result.body.data.push_inviato, false);
    assert.equal(result.body.data.notifiche_inviate, 0);
    assert.equal(getSaved(), 1);
    assert.equal(getSends(), 0);
    assert.deepEqual(events, ['save']);
  });
});

test('Firebase unavailable: in-app inbox persists without attempting any push', async () => {
  await withSyntheticInbox({ firebase: false }, async ({ request, getSaved, getSends }) => {
    const result = await request();
    assert.equal(result.status, 200);
    assert.equal(result.body.data.inbox_salvata, true);
    assert.equal(result.body.data.push_inviato, false);
    assert.equal(result.body.data.firebase_admin_configurato, false);
    assert.equal(getSaved(), 1);
    assert.equal(getSends(), 0);
  });
});

test('successful Firebase send occurs only after inbox INSERT', async () => {
  await withSyntheticInbox({ tokens: ['fake-device-token'] }, async ({ request, events }) => {
    const result = await request();
    assert.equal(result.status, 200);
    assert.equal(result.body.data.inbox_salvata, true);
    assert.equal(result.body.data.push_inviato, true);
    assert.equal(result.body.data.notifiche_inviate, 1);
    assert.deepEqual(events, ['save', 'push']);
  });
});

test('Firebase send fails: inbox is still saved and response does not claim push success', async () => {
  await withSyntheticInbox({ tokens: ['fake-device-token'], pushFails: true },
    async ({ request, getSaved, getSends }) => {
      const result = await request();
      assert.equal(result.status, 200);
      assert.equal(result.body.data.inbox_salvata, true);
      assert.equal(result.body.data.push_inviato, false);
      assert.equal(result.body.data.notifiche_fallite, 1);
      assert.equal(getSaved(), 1);
      assert.equal(getSends(), 1);
    });
});

test('inbox INSERT fails: returns error, does not attempt external Firebase push', async () => {
  await withSyntheticInbox({ tokens: ['fake-device-token'], saveFails: true },
    async ({ request, events, getSaved, getSends }) => {
      const result = await request();
      assert.equal(result.status, 503);
      assert.equal(result.body.success, false);
      assert.match(result.body.error, /non salvata/);
      assert.equal(getSaved(), 0);
      assert.equal(getSends(), 0);
      assert.deepEqual(events, ['save']);
    });
});

test('invalid request: does not persist inbox or attempt push', async () => {
  await withSyntheticInbox({}, async ({ request, getSaved, getSends }) => {
    const result = await request({ userId: '' });
    assert.equal(result.status, 400);
    assert.equal(getSaved(), 0);
    assert.equal(getSends(), 0);
  });
});

test('retry with the same UUID does not duplicate inbox or re-send Firebase push', async () => {
  await withSyntheticInbox({ tokens: ['fake-device-token'] }, async ({ request, events, getSaved, getSends }) => {
    const first = await request();
    const retry = await request();
    assert.equal(first.status, 200);
    assert.equal(retry.status, 200);
    assert.equal(first.body.data.id_notifica, retry.body.data.id_notifica);
    assert.equal(retry.body.data.duplicata_evitata, true);
    assert.equal(retry.body.data.push_inviato, false);
    assert.equal(retry.body.data.push_non_ritentato, true);
    assert.equal(getSaved(), 1);
    assert.equal(getSends(), 1);
    assert.deepEqual(events, ['save', 'push', 'save']);
  });
});

test('concurrent requests with the same UUID produce only one inbox row and one push', async () => {
  await withSyntheticInbox({ tokens: ['fake-device-token'] }, async ({ request, getSaved, getSends }) => {
    const [a, b] = await Promise.all([request(), request()]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(getSaved(), 1);
    assert.equal(getSends(), 1);
    assert.equal([a.body.data.duplicata_evitata, b.body.data.duplicata_evitata].filter(Boolean).length, 1);
  });
});

test('reusing a UUID for a changed payload is rejected without push', async () => {
  await withSyntheticInbox({ tokens: ['fake-device-token'] }, async ({ request, getSaved, getSends }) => {
    assert.equal((await request()).status, 200);
    const replay = await request({ titolo: 'Altro titolo' });
    assert.equal(replay.status, 409);
    assert.equal(replay.body.success, false);
    assert.equal(getSaved(), 1);
    assert.equal(getSends(), 1);
  });
});

test('missing or malformed idempotency UUID rejects before writing or pushing', async () => {
  await withSyntheticInbox({ tokens: ['fake-device-token'] }, async ({ request, getSaved, getSends }) => {
    assert.equal((await request({ idempotencyKey: '' })).status, 400);
    assert.equal((await request({ idempotencyKey: 'not-a-uuid' })).status, 400);
    assert.equal(getSaved(), 0);
    assert.equal(getSends(), 0);
  });
});
