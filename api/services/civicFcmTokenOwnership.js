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

module.exports = { onlyTokensNotOwnedByOthers };
