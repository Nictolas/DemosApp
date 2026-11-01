'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CIVIC_TOPIC_BY_CATEGORY,
  isCivicPushEnabled,
  reconcileCivicTopicsForUser,
  unsubscribeCivicTopicsForToken,
  unsubscribeDisabledCivicTopicsForUser,
} = require('../services/civicPushTopics');
const { buildCivicPush, dispatchCivicNewInitiatives } =
  require('../services/civicNewInitiativePushDispatcher');

const ROOT = path.resolve(__dirname, '..', '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

function fakeMessaging() {
  const calls = [];
  return {
    calls,
    subscribeToTopic: async (tokens, topic) => {
      calls.push({ method: 'subscribe', tokens, topic });
      return { successCount: tokens.length, failureCount: 0 };
    },
    unsubscribeFromTopic: async (tokens, topic) => {
      calls.push({ method: 'unsubscribe', tokens, topic });
      return { successCount: tokens.length, failureCount: 0 };
    },
  };
}

test('FCM topic membership and delivery default to OFF', async () => {
  assert.equal(isCivicPushEnabled({}), false);
  assert.equal(isCivicPushEnabled({ CIVIC_NEW_INITIATIVE_PUSH_ENABLED: 'false' }), false);
  assert.equal(isCivicPushEnabled({ CIVIC_NEW_INITIATIVE_PUSH_ENABLED: 'true' }), true);
  const pool = { query: async () => { throw new Error('unexpected SQL'); } };
  assert.deepEqual(await reconcileCivicTopicsForUser(pool, 'user', { enabled: false }), {
    enabled: false, tokens: 0
  });
  assert.deepEqual(await dispatchCivicNewInitiatives(pool, { enabled: false }), {
    enabled: false, accepted: 0, failed: 0
  });
});

test('topic reconciliation trusts only active registered devices and stored opt-ins', async () => {
  const messaging = fakeMessaging();
  let sql = '';
  const pool = { query: async (query, params) => {
    sql = query;
    assert.deepEqual(params, ['verified-user']);
    return { rows: [{
      fcm_token: 'real-test-device-token',
      iniziative_popolari: true,
      referendum_abrogativi: false,
      eci: false,
    }] };
  } };
  const result = await reconcileCivicTopicsForUser(pool, 'verified-user', {
    enabled: true, messaging
  });
  assert.deepEqual(result, { enabled: true, tokens: 1 });
  assert.match(sql, /d\.is_active = TRUE/);
  assert.match(sql, /u\.status = 'a'/);
  assert.match(sql, /LEFT JOIN notifiche_preferenze/);
  assert.deepEqual(messaging.calls.map(c => [c.method, c.topic]), [
    ['subscribe', CIVIC_TOPIC_BY_CATEGORY.iniziative_popolari],
    ['unsubscribe', CIVIC_TOPIC_BY_CATEGORY.referendum_abrogativi],
    ['unsubscribe', CIVIC_TOPIC_BY_CATEGORY.eci],
  ]);
});

test('explicit opt-out revokes only requested subscriptions before write', async () => {
  const messaging = fakeMessaging();
  const pool = { query: async (sql, params) => {
    assert.match(sql, /FROM user_devices WHERE user_id = \$1 AND is_active = TRUE/);
    assert.deepEqual(params, ['verified-user']);
    return { rows: [{ fcm_token: 'test-token' }] };
  } };
  await unsubscribeDisabledCivicTopicsForUser(pool, 'verified-user', ['eci'], {
    enabled: true, messaging
  });
  assert.deepEqual(messaging.calls.map(c => c.topic), [CIVIC_TOPIC_BY_CATEGORY.eci]);
  const route = read('api/routes/notifiche.js');
  const beforeSave = route.indexOf('await unsubscribeDisabledCivicTopicsForUser(');
  const dbWrite = route.indexOf('INSERT INTO notifiche_preferenze', beforeSave);
  assert.ok(beforeSave >= 0 && dbWrite > beforeSave);
});

test('FCM subscription failure is sanitized and never signals opt-out success', async () => {
  const messaging = fakeMessaging();
  messaging.unsubscribeFromTopic = async () => {
    throw new Error('SECRET_FCM_TOKEN_WOULD_APPEAR_HERE');
  };
  await assert.rejects(
    unsubscribeCivicTopicsForToken('secret', { enabled: true, messaging }),
    e => e.message === 'CIVIC_TOPIC_SYNC_FAILED' &&
      !e.message.includes('SECRET_FCM_TOKEN_WOULD_APPEAR_HERE')
  );
});

test('old tokens are revoked on rotation, cleanup and logout', () => {
  const tokens = read('api/routes/fcm-tokens.js');
  const auth = read('client/src/hooks/use-auth.tsx');
  assert.match(tokens, /revokeSupersededCivicTokens\(userId, token, validExistingTokens\)/);
  assert.match(tokens, /await reconcileCivicTopicsForUser\(pool, userId\)/);
  assert.match(tokens, /router\.delete\('\/session', verifyToken/);
  assert.match(tokens, /await unsubscribeCivicTopicsForToken\(token\)/);
  assert.match(auth, /: '\/fcm-tokens\/session'/);
});

function eventPool({ blocked = false, unsafe = false } = {}) {
  const event = {
    id: 22, category: 'eci', official_id: '2026-000011',
    title: 'Official ECI example', status: 'pending',
  };
  const client = {
    release: () => {},
    query: async (sql, params) => {
      if (sql.includes('pg_advisory_lock(')) return { rows: [] };
      if (sql.includes('pg_advisory_unlock(')) return { rows: [{ unlocked: true }] };
      if (sql.includes('SELECT blocked FROM civic_push_delivery_guard')) {
        return { rows: [{ blocked }] };
      }
      if (sql.includes('SELECT EXISTS (') && sql.includes('FROM user_devices')) {
        return { rows: [{ unsafe }] };
      }
      if (sql.includes('UPDATE civic_new_initiative_notifications AS e')) {
        if (event.status !== 'pending') return { rows: [] };
        event.status = 'dispatching';
        return { rows: [{ ...event }] };
      }
      if (sql.includes("SET status = 'sent'")) {
        assert.deepEqual(params, [22]);
        event.status = 'sent';
        return { rowCount: 1 };
      }
      if (sql.includes("SET status = 'failed'")) {
        event.status = 'failed';
        event.error = params[1];
        return { rowCount: 1 };
      }
      throw new Error('Unexpected SQL');
    },
  };
  return { event, connect: async () => client };
}

test('one accepted topic send per event, never a send per user', async () => {
  const pool = eventPool();
  const messages = [];
  const messaging = { send: async payload => { messages.push(payload); return 'FCM_MESSAGE_ID'; } };
  const [a, b] = await Promise.all([
    dispatchCivicNewInitiatives(pool, { enabled: true, messaging }),
    dispatchCivicNewInitiatives(pool, { enabled: true, messaging })
  ]);
  assert.equal(a.accepted + b.accepted, 1);
  assert.equal(messages.length, 1);
  assert.equal(pool.event.status, 'sent');
  assert.equal(messages[0].topic, CIVIC_TOPIC_BY_CATEGORY.eci);
  assert.deepEqual(Object.keys(messages[0].data).sort(), [
    'category','event_id','link','official_id','type'
  ]);
  assert.equal(messages[0].data.link, 'https://www.demos.community/eci?initiative=2026-000011');
  assert.ok(!('token' in messages[0]));
  assert.ok(!('user_id' in messages[0].data));
});

test('a blocked delivery guard or suspended subscriber prevents any topic send', async () => {
  for (const options of [{ blocked: true }, { unsafe: true }]) {
    const pool = eventPool(options);
    let sends = 0;
    const summary = await dispatchCivicNewInitiatives(pool, {
      enabled: true,
      messaging: { send: async () => { sends++; } }
    });
    assert.deepEqual(summary, { enabled: true, blocked: true, accepted: 0, failed: 0 });
    assert.equal(sends, 0);
    assert.equal(pool.event.status, 'pending');
  }
});

test('account erasure blocks delivery if any Firebase unsubscription fails', () => {
  const handler = read('api/routes/user/delete-account.js');
  const guard = read('api/services/civicPushDeliveryGuard.js');
  const migration = read('api/database/20261101_civic_new_initiative_notifications.sql');
  assert.match(handler, /lockCivicPushDuringAccountErasure\(client\)/);
  assert.match(handler, /unsubscribeCivicTopicsForToken\(device.fcm_token\)/);
  assert.match(handler, /blockCivicDeliveryOnRevocationFailure\(client\)/);
  assert.ok(handler.indexOf('blockCivicDeliveryOnRevocationFailure(client)') <
    handler.indexOf('await PrivacyErasureLedgerService.enforceAccountDeletion(client, userId)'));
  assert.match(guard, /pg_advisory_xact_lock/);
  assert.match(guard, /pg_advisory_lock/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS civic_push_delivery_guard/);
  assert.match(migration, /VALUES \(1, TRUE, 'ROLLOUT_NOT_APPROVED'\)/);
});

test('uncertain FCM errors do not trigger retries or include provider messages', async () => {
  const pool = eventPool();
  let calls = 0;
  const messaging = { send: async () => {
    calls++;
    throw new Error('PRIVATE_FCM_ERROR_WITH_TOKEN');
  } };
  const first = await dispatchCivicNewInitiatives(pool, { enabled: true, messaging });
  const second = await dispatchCivicNewInitiatives(pool, { enabled: true, messaging });
  assert.equal(first.failed, 1);
  assert.equal(second.failed, 0);
  assert.equal(calls, 1);
  assert.equal(pool.event.status, 'failed');
  assert.equal(pool.event.error, 'FCM_DELIVERY_UNCERTAIN');
});

test('dispatcher has a hard batch cap and only explicit category routes', () => {
  for (const key of Object.keys(CIVIC_TOPIC_BY_CATEGORY)) {
    const payload = buildCivicPush({ id: 4, category: key, official_id: '123', title: 'test' });
    assert.match(payload.data.link, /^https:\/\/www\.demos\.community\//);
  }
  assert.throws(() => buildCivicPush({ category: 'other' }), /CIVIC_UNSUPPORTED_CATEGORY/);
  const router = read('api/routes/civicPushDispatch.js');
  assert.match(router, /crypto\.timingSafeEqual\(a, b\)/);
  assert.match(router, /expected\.length < 32/);
  assert.match(router, /!isCivicPushEnabled\(\)/);
});

test('official initiative deep links reuse existing fetched list', () => {
  const paths = [
    'client/src/pages/ECI/index.tsx',
    'client/src/pages/IniziativePopolari/index.tsx',
    'client/src/pages/ReferendumAbrogativi/index.tsx',
  ];
  for (const path of paths) {
    const source = read(path);
    assert.match(source, /new URLSearchParams/);
    assert.match(source, /get\("initiative"\)/);
    assert.match(source, /deepLinkHandled.current = true/);
  }
});

test('ECI dispatch requires explicitly enabled GitHub Action and two secrets', () => {
  const workflow = read('.github/workflows/eci_sync.yml');
  assert.match(workflow, /vars\.CIVIC_NEW_INITIATIVE_PUSH_ENABLED == 'true'/);
  assert.match(workflow, /secrets\.CIVIC_PUSH_DISPATCH_URL/);
  assert.match(workflow, /secrets\.CIVIC_PUSH_DISPATCH_KEY/);
});
