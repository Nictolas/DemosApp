'use strict';

// Shared, read-only FCM recipient resolution for ordinary communications,
// Demos broadcasts and animal sighting notifications. The canonical device
// registry overrides stale legacy values even when a matching device is
// inactive or belongs to another user.
const RECIPIENT_FCM_TOKENS_LATERAL_SQL = `LEFT JOIN LATERAL (
  SELECT ARRAY(
    SELECT DISTINCT canonical_token
    FROM (
      SELECT btrim(d.fcm_token) AS canonical_token
      FROM public.user_devices d
      WHERE d.user_id = u.id
        AND d.is_active = TRUE
        AND d.fcm_token IS NOT NULL
        AND btrim(d.fcm_token) <> ''
      UNION
      SELECT btrim(legacy.token) AS canonical_token
      FROM unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) AS legacy(token)
      WHERE legacy.token IS NOT NULL
        AND btrim(legacy.token) <> ''
        AND CASE
          -- Fast path: use the existing unique fcm_token index when exact.
          WHEN EXISTS (
            SELECT 1 FROM public.user_devices registered
            WHERE registered.fcm_token = btrim(legacy.token)
          ) THEN FALSE
          -- Keep the normalized check for old rows with surrounding spaces.
          ELSE NOT EXISTS (
            SELECT 1 FROM public.user_devices registered
            WHERE btrim(registered.fcm_token) = btrim(legacy.token)
          )
        END
    ) candidates
    WHERE canonical_token <> ''
  ) AS tokens
) tokens ON TRUE`;

async function loadRecipientFcmTokensForUser(pool, userId) {
  if (!userId) return [];
  const result = await pool.query(
    `SELECT COALESCE(tokens.tokens, ARRAY[]::text[]) AS fcm_tokens
     FROM public.users u
     ${RECIPIENT_FCM_TOKENS_LATERAL_SQL}
     WHERE u.id = $1::uuid`,
    [userId]
  );
  return result.rows[0]?.fcm_tokens || [];
}

// Fresh, fail-closed read for asynchronous fan-out: after the initial list
// was read an account may have revoked a token or transferred a device.
// Avoid a network send unless the token is still resolved for this owner.
// There is no claim of atomicity after this SELECT reaches Firebase.
async function isRecipientFcmTokenCurrentlyActive(pool, { userId, token } = {}) {
  const normalized = typeof token === 'string' ? token.trim() : '';
  if (!userId || !normalized) return false;
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM public.users u
       ${RECIPIENT_FCM_TOKENS_LATERAL_SQL}
       WHERE u.id = $1::uuid
         AND $2::text = ANY(COALESCE(tokens.tokens, ARRAY[]::text[]))
     ) AS eligible`,
    [userId, normalized]
  );
  return result.rows[0]?.eligible === true;
}

module.exports = {
  RECIPIENT_FCM_TOKENS_LATERAL_SQL,
  loadRecipientFcmTokensForUser,
  isRecipientFcmTokenCurrentlyActive,
};
