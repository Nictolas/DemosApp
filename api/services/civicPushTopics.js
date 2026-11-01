'use strict';

const { getFirebaseAdmin } = require('./firebaseAdmin');
const { blockCivicDeliveryFromPool } = require('./civicPushDeliveryGuard');

const CIVIC_TOPIC_BY_CATEGORY = Object.freeze({
  iniziative_popolari: 'demos_civic_it_popular_new',
  referendum_abrogativi: 'demos_civic_it_referendum_new',
  eci: 'demos_civic_eu_eci_new',
});

function isCivicPushEnabled(env = process.env) {
  // Default OFF: no topic membership changes and no sends until approved rollout.
  return env.CIVIC_NEW_INITIATIVE_PUSH_ENABLED === 'true';
}

function getMessagingClient(override = null) {
  if (override) return override;
  const admin = getFirebaseAdmin();
  if (!admin) {
    const error = new Error('CIVIC_FIREBASE_UNAVAILABLE');
    error.code = 'CIVIC_FIREBASE_UNAVAILABLE';
    throw error;
  }
  return admin.messaging();
}

async function changeTopic(messaging, token, topic, subscribe) {
  try {
    const result = subscribe
      ? await messaging.subscribeToTopic([token], topic)
      : await messaging.unsubscribeFromTopic([token], topic);
    if (result?.failureCount > 0) throw new Error('FCM_SUBSCRIPTION_REJECTED');
  } catch {
    // Firebase may include token identifiers in diagnostics: do not expose them.
    const error = new Error('CIVIC_TOPIC_SYNC_FAILED');
    error.code = 'CIVIC_TOPIC_SYNC_FAILED';
    throw error;
  }
}

/**
 * Only authenticated server flows call this with the userId from a verified JWT.
 * Never accept a topic, target userId or FCM token from an untrusted preference payload.
 * The DB is authoritative; topic subscriptions are a derived, revocable delivery index.
 */
async function reconcileCivicTopicsForUser(pool, userId, {
  enabled = isCivicPushEnabled(),
  messaging = null,
} = {}) {
  if (!enabled) return { enabled: false, tokens: 0 };
  if (!userId || !pool || typeof pool.query !== 'function') {
    throw new TypeError('CIVIC_USER_CONTEXT_REQUIRED');
  }

  const result = await pool.query(`
    SELECT d.fcm_token,
           COALESCE(p.iniziative_popolari, FALSE) AS iniziative_popolari,
           COALESCE(p.referendum_abrogativi, FALSE) AS referendum_abrogativi,
           COALESCE(p.eci, FALSE) AS eci
    FROM user_devices d
    JOIN users u ON u.id = d.user_id
    LEFT JOIN notifiche_preferenze p ON p.user_id = d.user_id
    WHERE d.user_id = $1
      AND d.is_active = TRUE
      AND u.status = 'a'
  `, [userId]);

  if (result.rows.length === 0) return { enabled: true, tokens: 0 };

  try {
    const client = getMessagingClient(messaging);
    for (const row of result.rows) {
      for (const [category, topic] of Object.entries(CIVIC_TOPIC_BY_CATEGORY)) {
        await changeTopic(client, row.fcm_token, topic, row[category] === true);
      }
    }
  } catch {
    // Partially applied topic changes are uncertain: stop new global sends.
    await blockCivicDeliveryFromPool(pool);
    throw new Error('CIVIC_TOPIC_SYNC_FAILED');
  }
  return { enabled: true, tokens: result.rows.length };
}

/**
 * Revoke old device membership BEFORE replacing ownership or deactivating tokens.
 * This intentionally performs no database writes. An SDK failure must block the
 * caller's token mutation while the sender is active.
 */
async function unsubscribeCivicTopicsForToken(token, {
  enabled = isCivicPushEnabled(),
  messaging = null,
} = {}) {
  if (!enabled) return { enabled: false };
  if (typeof token !== 'string' || !token) throw new TypeError('CIVIC_TOKEN_REQUIRED');
  const client = getMessagingClient(messaging);
  for (const topic of Object.values(CIVIC_TOPIC_BY_CATEGORY)) {
    await changeTopic(client, token, topic, false);
  }
  return { enabled: true };
}

/**
 * Opt-out must happen BEFORE the database acknowledges disabled preferences.
 * Otherwise an unavailable Firebase service could leave an unsubscribed state in
 * Postgres while the actual device keeps receiving pushes.
 */
async function unsubscribeDisabledCivicTopicsForUser(pool, userId, disabledCategories, {
  enabled = isCivicPushEnabled(),
  messaging = null,
} = {}) {
  if (!enabled || !disabledCategories?.length) return { enabled, tokens: 0 };
  if (!userId || !pool || typeof pool.query !== 'function') {
    throw new TypeError('CIVIC_USER_CONTEXT_REQUIRED');
  }
  const categories = [...new Set(disabledCategories)];
  if (categories.some(category => !Object.hasOwn(CIVIC_TOPIC_BY_CATEGORY, category))) {
    throw new TypeError('CIVIC_CATEGORY_UNSUPPORTED');
  }
  const { rows } = await pool.query(
    'SELECT fcm_token FROM user_devices WHERE user_id = $1 AND is_active = TRUE',
    [userId]
  );
  if (!rows.length) return { enabled: true, tokens: 0 };
  try {
    const client = getMessagingClient(messaging);
    for (const row of rows) {
      for (const category of categories) {
        await changeTopic(client, row.fcm_token, CIVIC_TOPIC_BY_CATEGORY[category], false);
      }
    }
  } catch {
    // User asked to stop: never keep topic sending while revocation is uncertain.
    await blockCivicDeliveryFromPool(pool);
    throw new Error('CIVIC_TOPIC_SYNC_FAILED');
  }
  return { enabled: true, tokens: rows.length };
}

module.exports = {
  CIVIC_TOPIC_BY_CATEGORY,
  isCivicPushEnabled,
  reconcileCivicTopicsForUser,
  unsubscribeCivicTopicsForToken,
  unsubscribeDisabledCivicTopicsForUser,
};
