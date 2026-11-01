'use strict';

// On first rollout, preferences may have been stored while FCM topics were
// disabled. Rebuild the topic index from the DB without one SQL query per user.
// This does not send notifications or unlock the delivery guard.

const { getFirebaseAdmin } = require('./firebaseAdmin');
const { CIVIC_TOPIC_BY_CATEGORY, isCivicPushEnabled } = require('./civicPushTopics');
const {
  acquireCivicPushDeliveryLock,
  releaseCivicPushDeliveryLock,
} = require('./civicPushDeliveryGuard');

async function reconcileAllCivicTopics(pool, {
  dryRun = true,
  enabled = isCivicPushEnabled(),
  messaging = null,
  batchSize = 500,
} = {}) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('CIVIC_POOL_REQUIRED');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new RangeError('CIVIC_BOOTSTRAP_BATCH_INVALID');
  }
  if (!dryRun && !enabled) throw new Error('CIVIC_PUSH_DISABLED');

  // Use the same exclusive lock as the dispatcher and account erasure.
  // A separate pool.query() could permit sends between the guard check
  // and topic synchronization, even though the guard starts blocked.
  const db = await pool.connect();
  let lockAttempted = false;
  let locked = false;
  let discard = false;
  try {
    lockAttempted = true;
    await acquireCivicPushDeliveryLock(db);
    locked = true;
    const gate = await db.query(
      'SELECT blocked FROM civic_push_delivery_guard WHERE id = 1'
    );
    if (gate.rows.length !== 1 || gate.rows[0].blocked !== true) {
      throw new Error('CIVIC_BOOTSTRAP_REQUIRES_BLOCKED_DELIVERY');
    }

    // A dry run must never instantiate Firebase or alter subscriptions.
    const firebase = dryRun ? null : messaging || getFirebaseAdmin()?.messaging();
    if (!dryRun && (!firebase ||
        typeof firebase.subscribeToTopic !== 'function' ||
        typeof firebase.unsubscribeFromTopic !== 'function')) {
      throw new Error('CIVIC_FIREBASE_UNAVAILABLE');
    }

    let lastId = '0';
    let scanned = 0;
    const counts = Object.fromEntries(Object.keys(CIVIC_TOPIC_BY_CATEGORY).map(
      category => [category, { subscribed: 0, unsubscribed: 0 }]
    ));

    while (true) {
      // Keyset pagination: one SQL read per batch, never per recipient.
      const result = await db.query(`
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
          // Reconcile revoked memberships first; any failure leaves the
          // database delivery guard blocked and requires operator review.
          for (const [tokens, subscribe] of [[no, false], [yes, true]]) {
            if (!tokens.length) continue;
            let response;
            try {
              response = subscribe
                ? await firebase.subscribeToTopic(tokens, topic)
                : await firebase.unsubscribeFromTopic(tokens, topic);
            } catch {
              throw new Error('CIVIC_BOOTSTRAP_FCM_FAILED');
            }
            if (!response || response.failureCount !== 0 ||
                response.successCount !== tokens.length) {
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
  } finally {
    if (locked) {
      try {
        await releaseCivicPushDeliveryLock(db);
      } catch {
        // Never return a session with an unknown advisory lock to the pool.
        discard = true;
      }
    } else if (lockAttempted) {
      discard = true;
    }
    db.release(discard);
  }
}
module.exports = { reconcileAllCivicTopics };
