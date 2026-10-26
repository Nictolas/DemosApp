'use strict';

// Canonical device rows, including inactive or transferred registrations,
// always override historical users.fcm_tokens copies.
const RESOLVED_FCM_TOKENS_LATERAL_SQL = `
  SELECT ARRAY(
    SELECT token FROM (
      SELECT btrim(d.fcm_token) AS token
      FROM public.user_devices d
      WHERE d.user_id = u.id
        AND d.is_active IS TRUE
        AND d.fcm_token IS NOT NULL
        AND btrim(d.fcm_token) <> ''
      UNION
      SELECT btrim(legacy.token) AS token
      FROM unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) AS legacy(token)
      WHERE legacy.token IS NOT NULL
        AND btrim(legacy.token) <> ''
        AND CASE
          WHEN EXISTS (
            SELECT 1 FROM public.user_devices registered
            WHERE registered.fcm_token = btrim(legacy.token)
          ) THEN FALSE
          ELSE NOT EXISTS (
            SELECT 1 FROM public.user_devices registered
            WHERE btrim(registered.fcm_token) = btrim(legacy.token)
          )
        END
    ) eligible
  ) AS tokens
`;

async function getResolvedUserFcmTokens(pool, userId) {
  if (!userId) return [];
  const result = await pool.query(
    `SELECT r.tokens AS fcm_tokens
     FROM public.users u
     CROSS JOIN LATERAL (${RESOLVED_FCM_TOKENS_LATERAL_SQL}) r
     WHERE u.id = $1`, [userId]
  );
  return result.rows[0]?.fcm_tokens || [];
}

// Recheck just before Firebase I/O: errors propagate and block delivery,
// without marking the affected token as invalid.
async function isUserFcmTokenEligible(pool, { userId, token } = {}) {
  if (!userId || typeof token !== 'string' || !token.trim()) return false;
  const result = await pool.query(
    `SELECT ($2::text = ANY(r.tokens)) AS eligible
     FROM public.users u
     CROSS JOIN LATERAL (${RESOLVED_FCM_TOKENS_LATERAL_SQL}) r
     WHERE u.id = $1`, [userId, token.trim()]
  );
  return result.rows[0]?.eligible === true;
}

module.exports = {
  RESOLVED_FCM_TOKENS_LATERAL_SQL,
  getResolvedUserFcmTokens,
  isUserFcmTokenEligible,
};
