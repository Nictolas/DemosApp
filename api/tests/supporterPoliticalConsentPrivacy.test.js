'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadSupporterUserIds } = require('../services/politicalSelectionService');
const { loadCurrentSupporterTokens } = require('../services/currentSupporterPushService');
const { createSupporterOpinionNotifications } = require('../services/politicalOpinionNotificationService');

const consentPredicate =
  /COALESCE\(uc\.political_opinions_consent,\s*(?:u|supporter)\.political_opinions_consent,\s*false\) IS TRUE/;

function assertScoped(sql) {
  assert.match(sql, /LEFT JOIN public\.user_consents uc ON uc\.user_id = (?:u|supporter)\.id/);
  assert.match(sql, consentPredicate);
}

test('canonical supporter lookup filters political consent in the same SELECT', async () => {
  let statements = 0;
  const db = { async query(sql, params) {
    statements++;
    assert.match(sql, /FROM public\.political_selections ps/);
    assert.match(sql, /JOIN public\.users u ON u\.id = ps\.user_id/);
    assert.match(sql, /u\.status = 'a'/);
    assertScoped(sql);
    assert.deepEqual(params, ['synthetic-subject', 'representative', 'it.camera']);
    return { rows: [{ id: 'synthetic-consented' }] };
  } };
  const result = await loadSupporterUserIds(db, {
    selectedUserId: 'synthetic-subject', kind: 'representative', officeId: 'it.camera'
  });
  assert.equal(result.source, 'CANONICAL');
  assert.deepEqual(result.userIds, ['synthetic-consented']);
  assert.equal(statements, 1);
});

test('legacy fallback also excludes revoked supporters, without losing office scoping', async () => {
  let lookups = 0;
  const db = { async query(sql, params) {
    lookups++;
    if (/FROM public\.political_selections ps/.test(sql)) {
      const e = Error('synthetic relation missing');
      e.code = '42P01';
      throw e;
    }
    assert.match(sql, /FROM public\.users u/);
    assertScoped(sql);
    assert.match(sql, /u\.status = 'a'/);
    assert.match(sql, /rappresentante_camera/);
    assert.deepEqual(params, ['synthetic-subject']);
    return { rows: [{ id: 'synthetic-consented' }] };
  } };
  const result = await loadSupporterUserIds(db, {
    selectedUserId: 'synthetic-subject', kind: 'representative', officeId: 'it.camera'
  });
  assert.equal(result.source, 'LEGACY');
  assert.deepEqual(result.userIds, ['synthetic-consented']);
  assert.equal(lookups, 2);
});

test('push token lookup rechecks consent after reading supporter IDs', async () => {
  let lookups = 0;
  const db = { async query(sql) {
    lookups++;
    if (/FROM public\.political_selections ps/.test(sql)) {
      assertScoped(sql);
      return { rows: [{ id: 'synthetic-consented' }] };
    }
    if (/FROM users u/.test(sql)) {
      assertScoped(sql);
      assert.match(sql, /u\.id::text = ANY\(\$1::text\[\]\)/);
      return { rows: [{ id: 'synthetic-consented', fcm_tokens: ['synthetic-token'] }] };
    }
    throw Error('Unexpected SQL');
  } };
  const rows = await loadCurrentSupporterTokens(db, {
    subjectUserId: 'synthetic-subject', kind: 'representative', level: 'CAMERA'
  });
  assert.deepEqual(rows, [{ userId: 'synthetic-consented', tokens: ['synthetic-token'] }]);
  assert.equal(lookups, 2);
});

test('legacy push token path also rechecks consent after a missing device table', async () => {
  let attempts = 0;
  const db = { async query(sql) {
    if (/FROM public\.political_selections ps/.test(sql)) return { rows: [{ id: 'synthetic-consented' }] };
    attempts++;
    assertScoped(sql);
    if (attempts === 1) {
      assert.match(sql, /FROM user_devices d/);
      const e = Error('synthetic device table missing');
      e.code = '42P01';
      throw e;
    }
    assert.doesNotMatch(sql, /FROM user_devices d/);
    return { rows: [{ id: 'synthetic-consented', fcm_tokens: ['synthetic-old-token'] }] };
  } };
  const rows = await loadCurrentSupporterTokens(db, {
    subjectUserId: 'synthetic-subject', kind: 'candidate', level: 'CAMERA'
  });
  assert.deepEqual(rows, [{ userId: 'synthetic-consented', tokens: ['synthetic-old-token'] }]);
  assert.equal(attempts, 2);
});

test('notification INSERT filters consent again so a revocation between reads is respected', async () => {
  const seen = [];
  const db = { async query(sql, params) {
    seen.push(String(sql));
    if (/FROM public\.political_selections ps/.test(sql)) return {
      rows: [{ id: '11111111-1111-1111-1111-111111111122' }]
    };
    if (/FROM public\.opinioni_domande/.test(sql)) return { rows: [{ id: '42', text: 'Test question' }] };
    if (/INSERT INTO public\.political_opinion_notifications/.test(sql)) {
      assert.match(sql, /FROM public\.users supporter/);
      assertScoped(sql);
      assert.match(sql, /supporter\.status = 'a'/);
      assert.deepEqual(params[5], ['11111111-1111-1111-1111-111111111122']);
      return { rowCount: 0, rows: [] }; // revocation completed before SQL statement
    }
    throw Error('Unexpected SQL');
  } };
  const result = await createSupporterOpinionNotifications(db, {
    subjectUserId: '11111111-1111-1111-1111-111111111111',
    changes: [{ opinionId: '42', previousValue: 'f', newValue: 'c' }]
  });
  assert.deepEqual(result, { created: 0, changes: 1 });
  assert.equal(seen.length, 3);
});

test('no selected target or no opinion changes does not query political selections', async () => {
  const db = { query() { throw Error('must not query'); } };
  const noSupporters = await loadSupporterUserIds(db, { selectedUserId: null });
  assert.deepEqual(noSupporters.userIds, []);
  const noChanges = await createSupporterOpinionNotifications(db, {
    subjectUserId: 'synthetic-subject',
    changes: [{ opinionId: '42', previousValue: 'f', newValue: 'f' }]
  });
  assert.deepEqual(noChanges, { created: 0, changes: 0 });
});
