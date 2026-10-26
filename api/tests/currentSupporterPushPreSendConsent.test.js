'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { isCurrentSupporterTokenEligible } = require('../services/currentSupporterPushService');

test('pre-send proof uses only public account, consent, and device tables with bound user/token', async () => {
  const seen = [];
  const db = { async query(sql, params) {
    seen.push({ sql: String(sql), params });
    return { rows: [{ eligible: true }] };
  } };
  assert.equal(await isCurrentSupporterTokenEligible(db, {
    userIds: [' user-one ', 'user-one', 'user-two'], token: ' device-A '
  }), true);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].params, [['user-one', 'user-two'], 'device-A']);
  assert.match(seen[0].sql, /FROM public\.users u/);
  assert.match(seen[0].sql, /u\.id = ANY\(\$1::uuid\[\]\)/);
  assert.doesNotMatch(seen[0].sql, /u\.id::text = ANY/);
  assert.match(seen[0].sql, /LEFT JOIN public\.user_consents uc/);
  assert.match(seen[0].sql, /FROM public\.user_devices d/);
  assert.match(seen[0].sql,
    /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.user_devices registered/);
  assert.match(seen[0].sql, /registered\.fcm_token = \$2/);
  assert.match(seen[0].sql, /btrim\(registered\.fcm_token\) = \$2/);
  assert.match(seen[0].sql, /WHEN EXISTS\s*\([\s\S]*THEN FALSE\s*ELSE NOT EXISTS/);
  assert.match(seen[0].sql, /OR EXISTS\s*\(\s*SELECT 1 FROM public\.user_devices d/);
  assert.match(seen[0].sql, /d\.is_active = TRUE/);
  assert.match(seen[0].sql, /u\.status = 'a'/);
  assert.match(seen[0].sql, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
  assert.match(seen[0].sql, /unnest\(COALESCE\(u\.fcm_tokens/);
  assert.match(seen[0].sql, /btrim\(d\.fcm_token\) = \$2/);
});

test('pre-send recheck rejects empty token and empty owner set without querying', async () => {
  const db = { query() { throw Error('must not call database'); } };
  assert.equal(await isCurrentSupporterTokenEligible(db, { userIds: [], token: 'valid-token' }), false);
  assert.equal(await isCurrentSupporterTokenEligible(db, { userIds: ['user'], token: '  ' }), false);
});

test('missing canonical device table uses canonical legacy tokens and still requires consent', async () => {
  const statements = [];
  const db = { async query(sql, params) {
    statements.push(String(sql));
    assert.deepEqual(params, [['user-1'], 'legacy-token']);
    if (statements.length === 1) {
      const e = Error('missing synthetic device table');
      e.code = '42P01';
      throw e;
    }
    return { rows: [{ eligible: false }] };
  } };
  assert.equal(await isCurrentSupporterTokenEligible(db, {
    userIds: ['user-1'], token: 'legacy-token'
  }), false);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /FROM public\.user_devices d/);
  assert.doesNotMatch(statements[1], /FROM public\.user_devices d/);
  assert.match(statements[1], /FROM public\.users u/);
  assert.match(statements[1], /LEFT JOIN public\.user_consents uc/);
});

test('unexpected database errors propagate so caller can suppress the push', async () => {
  const db = { async query() { throw Object.assign(Error('database offline'), { code: '08006' }); } };
  await assert.rejects(
    isCurrentSupporterTokenEligible(db, { userIds: ['user'], token: 'token' }),
    (error) => error.code === '08006'
  );
});

test('a consent revocation after token discovery suppresses subsequent Firebase sends', async () => {
  // Swap the imported admin facade for a local stub. This test never loads
  // Firebase credentials or contacts an external push provider.
  const firebasePath = require.resolve('../services/firebaseAdmin');
  const servicePath = require.resolve('../services/currentSupporterPushService');
  const firebase = require(firebasePath);
  const previous = firebase.getFirebaseAdmin;
  const sent = [];
  let granted = true;
  const admin = { messaging: () => ({ send: async (message) => {
    sent.push(message.token);
    // User revokes while the first provider send finishes.
    granted = false;
  } }) };
  firebase.getFirebaseAdmin = () => admin;
  delete require.cache[servicePath];
  try {
    const { sendPushToCurrentSupporters } = require(servicePath);
    const db = { async query(sql, params) {
      const q = String(sql);
      if (q.includes('FROM public.political_selections ps')) return { rows: [{ id: 'user-1' }] };
      if (q.includes('ARRAY(') && q.includes('FROM public.users u')) {
        return { rows: [{ id: 'user-1', fcm_tokens: ['token-1', 'token-2'] }] };
      }
      if (q.startsWith('SELECT EXISTS') && q.includes('FROM public.users u')) {
        assert.deepEqual(params[0], ['user-1']);
        return { rows: [{ eligible: granted }] };
      }
      throw Error('Unexpected synthetic query');
    } };
    const result = await sendPushToCurrentSupporters(db, {
      subjectUserId: 'politician-1', kind: 'representative', level: 'CAMERA',
      title: 'Test', body: 'Synthetic payload'
    });
    assert.deepEqual(sent, ['token-1']);
    assert.deepEqual(result, {
      targetedUsers: 1, tokens: 2, sent: 1, failed: 0, skipped: 1, firebaseAvailable: true
    });
  } finally {
    firebase.getFirebaseAdmin = previous;
    delete require.cache[servicePath];
  }
});

test('database uncertainty and a detached token fail closed before contacting Firebase', async () => {
  const firebasePath = require.resolve('../services/firebaseAdmin');
  const servicePath = require.resolve('../services/currentSupporterPushService');
  const firebase = require(firebasePath);
  const previous = firebase.getFirebaseAdmin;
  const sent = [];
  firebase.getFirebaseAdmin = () => ({ messaging: () => ({ send: async (m) => { sent.push(m); } }) });
  delete require.cache[servicePath];
  try {
    const { sendPushToCurrentSupporters } = require(servicePath);
    let checks = 0;
    const db = { async query(sql) {
      const q = String(sql);
      if (q.includes('FROM public.political_selections ps')) return { rows: [{ id: 'user-1' }] };
      if (q.includes('ARRAY(') && q.includes('FROM public.users u')) {
        return { rows: [{ id: 'user-1', fcm_tokens: ['stale-device', 'db-error'] }] };
      }
      if (q.startsWith('SELECT EXISTS')) {
        checks += 1;
        if (checks === 1) return { rows: [{ eligible: false }] };
        throw Object.assign(Error('read failure'), { code: '08006' });
      }
      throw Error('Unexpected synthetic SQL');
    } };
    const result = await sendPushToCurrentSupporters(db, {
      subjectUserId: 'politician-1', kind: 'candidate', level: 'CAMERA',
      title: 'Test', body: 'Synthetic'
    });
    assert.equal(checks, 2);
    assert.deepEqual(sent, []);
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 2);
  } finally {
    firebase.getFirebaseAdmin = previous;
    delete require.cache[servicePath];
  }
});
