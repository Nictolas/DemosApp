'use strict';

// On token reassignment, the users.fcm_tokens legacy column may retain an
// earlier owner's value. The authoritative owner (including inactive devices)
// is user_devices. Revocation by the old account must never unsubscribe a
// token registered to another owner. Fail closed on DB lookup errors.
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
     WHERE user_id <> $1
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
  getActiveCivicUserDeviceTokens,
  getSupersededCivicTokens,
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

// Canonical user_devices is authoritative when legacy users.fcm_tokens is
// present but empty/stale. The most recently updated active token wins.
async function getActiveCivicUserDeviceTokens(db, userId) {
  if (!db || typeof db.query !== 'function' || !userId) {
    throw new TypeError('CIVIC_FCM_CANONICAL_CONTEXT_REQUIRED');
  }
  const result = await db.query(
    `SELECT fcm_token FROM user_devices
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY updated_at DESC NULLS LAST, fcm_token DESC`,
    [userId]
  );
  if (!result || !Array.isArray(result.rows) ||
      result.rows.some(row => typeof row?.fcm_token !== 'string')) {
    throw new Error('CIVIC_FCM_CANONICAL_READ_UNCONFIRMED');
  }
  return result.rows.map(row => row.fcm_token);
}

// Registration must clear old subscriptions before changing the token owner.
// The previous owner's device may already be INACTIVE while Firebase still
// holds a stale topic subscription, so it must also be revoked on transfer.
// Keep the current owner's other ACTIVE tokens for replacement revocation.
async function getSupersededCivicTokens(db,userId,tokenToKeep){
  if(!db||typeof db.query!=='function'||!userId||
     typeof tokenToKeep!=='string'||!tokenToKeep)
    throw new TypeError('CIVIC_FCM_SUPERSEDED_CONTEXT_REQUIRED');
  const result=await db.query(`
    SELECT fcm_token FROM user_devices
    WHERE (user_id=$1 AND is_active=TRUE AND fcm_token <> $2)
       OR (user_id<>$1 AND fcm_token=$2)`,[userId,tokenToKeep]);
  if(!result||!Array.isArray(result.rows)||
     result.rows.some(row=>typeof row?.fcm_token!=='string'))
    throw new Error('CIVIC_FCM_SUPERSEDED_LOOKUP_UNCONFIRMED');
  return [...new Set(result.rows.map(row=>row.fcm_token))];
}
