'use strict';

// On token reassignment, the users.fcm_tokens legacy column may retain an
// earlier owner's value. The authoritative active owner is user_devices.
// Revocation by that earlier account must not unsubscribe a different user's
// currently active token. Fail closed on DB read errors.
async function onlyTokensNotOwnedByOthers(db, userId, candidates) {
  if (!db || typeof db.query !== 'function' || !userId ||
      !Array.isArray(candidates)) {
    throw new TypeError('CIVIC_FCM_OWNER_CONTEXT_REQUIRED');
  }
  const tokens = [...new Set(candidates.filter(
    token => typeof token === 'string' && token.length > 0))];
  if (!tokens.length) return [];
  const result = await db.query(
    `SELECT fcm_token FROM user_devices
     WHERE is_active = TRUE AND user_id <> $1
       AND fcm_token = ANY($2::text[])`,
    [userId, tokens]
  );
  if (!result || !Array.isArray(result.rows)) {
    throw new Error('CIVIC_FCM_OWNER_LOOKUP_FAILED');
  }
  const foreign = new Set(result.rows.map(row => row.fcm_token));
  return tokens.filter(token => !foreign.has(token));
}

module.exports = {
  onlyTokensNotOwnedByOthers,
  onlyTokensNotRegisteredToOthers,
  upsertCleanupOwnedOrUnassignedToken,
};

// Legacy token cleanup must never reclaim a token registered to another
// account, even when that other account's device is currently inactive.
async function onlyTokensNotRegisteredToOthers(db, userId, candidates) {
  if (!db || typeof db.query !== 'function' || !userId ||
      !Array.isArray(candidates)) {
    throw new TypeError('CIVIC_FCM_CLEANUP_OWNER_CONTEXT_REQUIRED');
  }
  const tokens = [...new Set(candidates.filter(
    token => typeof token === 'string' && token.length > 0))];
  if (!tokens.length) return [];
  const result = await db.query(
    `SELECT fcm_token FROM user_devices
     WHERE user_id <> $1
       AND fcm_token = ANY($2::text[])`,
    [userId, tokens]
  );
  if (!result || !Array.isArray(result.rows)) {
    throw new Error('CIVIC_FCM_CLEANUP_OWNER_LOOKUP_FAILED');
  }
  const registeredElsewhere = new Set(result.rows.map(row => row.fcm_token));
  return tokens.filter(token => !registeredElsewhere.has(token));
}

// The filter and insert run in one transaction during civic push, but other
// services may write tokens concurrently. Recheck at the SQL conflict row:
// cleanup cannot transfer a device from another user, even on a race.
async function upsertCleanupOwnedOrUnassignedToken(db, userId, token) {
  if (!db || typeof db.query !== 'function' || !userId ||
      typeof token !== 'string' || token.length === 0) {
    throw new TypeError('CIVIC_FCM_CLEANUP_UPSERT_CONTEXT_REQUIRED');
  }
  const result = await db.query(
    `INSERT INTO user_devices
       (user_id, fcm_token, is_active, last_seen_at, created_at, updated_at)
     VALUES ($1, $2, TRUE, NOW(), NOW(), NOW())
     ON CONFLICT (fcm_token) DO UPDATE SET
       is_active = TRUE,
       last_seen_at = NOW(),
       updated_at = NOW()
     WHERE user_devices.user_id = EXCLUDED.user_id
     RETURNING fcm_token`,
    [userId, token]
  );
  if (!result || result.rowCount !== 1) {
    throw new Error('CIVIC_FCM_CLEANUP_OWNERSHIP_UNCONFIRMED');
  }
}
