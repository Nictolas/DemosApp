'use strict';

// On first rollout, preferences may have been stored while FCM topics were
// disabled. Rebuild the topic index from the DB without one SQL query per user.
// This does not send notifications or unlock the delivery guard.

const { getFirebaseAdmin } = require('./firebaseAdmin');
const { CIVIC_TOPIC_BY_CATEGORY, isCivicPushEnabled } = require('./civicPushTopics');

async function reconcileAllCivicTopics(pool, {
  dryRun = true,
  enabled = isCivicPushEnabled(),
  messaging = null,
  batchSize = 500,
} = {}) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('CIVIC_POOL_REQUIRED');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new RangeError('CIVIC_BOOTSTRAP_BATCH_INVALID');
  }
  // Never write to FCM without the separate release toggle.
  if (!dryRun && !enabled) throw new Error('CIVIC_PUSH_DISABLED');

  const gate = await pool.query(
    'SELECT blocked FROM civic_push_delivery_guard WHERE id = 1'
  );
  if (gate.rows.length !== 1 || gate.rows[0].blocked !== true) {
    // No bootstrap while topic sends are running, even for a dry run.
    throw new Error('CIVIC_BOOTSTRAP_REQUIRES_BLOCKED_DELIVERY');
  }

  const client = dryRun ? null : messaging || getFirebaseAdmin()?.messaging();
  if (!dryRun && (!client ||
      typeof client.subscribeToTopic !== 'function' ||
      typeof client.unsubscribeFromTopic !== 'function')) {
    throw new Error('CIVIC_FIREBASE_UNAVAILABLE');
  }

  let lastId = '0';
  let scanned = 0;
  const counts = Object.fromEntries(Object.keys(CIVIC_TOPIC_BY_CATEGORY).map(
    category => [category, { subscribed: 0, unsubscribed: 0 }]
  ));

  while (true) {
    // Include inactive devices so their old topic membership is revoked too.
    // IDs and FCM tokens must never appear in logs or return values.
    const result = await pool.query(`
      SELECT d.id, d.fcm_token, d.is_active,
             COALESCE(u.status, '') AS user_status,
             COALESCE(p.iniziative_popolari, FALSE) AS iniziative_popolari,
             COALESCE(p.referendum_abrogativi, FALSE) AS referendum_abrogativi,
             COALESCE(p.eci, FALSE) AS eci
      FROM user_devices d
      LEFT JOIN users u ON u.id = d.user_id
      LEFT JOIN notifiche_preferenze p ON p.user_id = d.user_id
      WHERE d.id > $1::bigint
      ORDER BY d.id ASC
      LIMIT $2
    `, [lastId, batchSize]);
    const rows = result.rows;
    if (!rows.length) break;

    for (const [category, topic] of Object.entries(CIVIC_TOPIC_BY_CATEGORY)) {
      const yes = [];
      const no = [];
      for (const row of rows) {
        const isAllowed = row.is_active === true
          && row.user_status === 'a'
          && row[category] === true;
        (isAllowed ? yes : no).push(row.fcm_token);
      }
      counts[category].subscribed += yes.length;
      counts[category].unsubscribed += no.length;

      if (!dryRun) {
        // Unsubscribe undesired devices first; a partial failure keeps the
        // barrier locked. Safe to re-run from the beginning if needed.
        for (const [tokens, subscribe] of [[no, false], [yes, true]]) {
          if (!tokens.length) continue;
          const response = subscribe
            ? await client.subscribeToTopic(tokens, topic)
            : await client.unsubscribeFromTopic(tokens, topic);
          if (!response || response.failureCount !== 0 ||
              response.successCount !== tokens.length) {
            // Provider details may include FCM tokens, so never relay them.
            throw new Error('CIVIC_BOOTSTRAP_FCM_FAILED');
          }
        }
      }
    }

    scanned += rows.length;
    lastId = String(rows[rows.length - 1].id);
    if (rows.length < batchSize) break;
  }

  return { dryRun, scanned, categories: counts, guardRemainsBlocked: true };
}

module.exports = { reconcileAllCivicTopics };
