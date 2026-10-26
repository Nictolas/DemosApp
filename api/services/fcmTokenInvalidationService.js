'use strict';

// A single account-locked invalidation path shared by all Firebase senders.
// Never delete canonical device rows: inactive records must override stale
// legacy tokens (see currentSupporterPushService).
function sanitizeTokens(tokens) {
  return [...new Set((Array.isArray(tokens) ? tokens : [])
    .filter(token => typeof token === 'string')
    .map(token => token.trim())
    .filter(Boolean))];
}

async function invalidateFailedFcmTokens(pool, { userId, tokens } = {}) {
  const invalidTokens = sanitizeTokens(tokens);
  if (!userId || invalidTokens.length === 0) {
    return { invalidated: 0, skipped: true };
  }
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    // Same lock order as the FCM registration / cleanup / revocation router.
    // A late invalidation for a former owner cannot disable a transferred
    // token because the device UPDATE always checks that user's ID.
    const owner = await client.query(
      'SELECT id FROM public.users WHERE id = $1 FOR UPDATE', [userId]
    );
    if (!owner.rows.length) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return { invalidated: 0, skipped: true };
    }
    const canonical = await client.query(
      `UPDATE public.user_devices
       SET is_active = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND is_active = TRUE
         AND btrim(fcm_token) = ANY($2::text[])`,
      [userId, invalidTokens]
    );

    // PostgreSQL aborts a transaction on a missing-column error (42703).
    // A savepoint is required before the optional legacy-array access.
    await client.query('SAVEPOINT fcm_invalid_legacy');
    let legacyRemoved = 0;
    try {
      const found = await client.query(
        'SELECT COALESCE(fcm_tokens, ARRAY[]::text[]) AS fcm_tokens ' +
        'FROM public.users WHERE id = $1', [userId]
      );
      const prior = found.rows[0]?.fcm_tokens || [];
      const kept = prior.filter(token =>
        typeof token !== 'string' || !invalidTokens.includes(token.trim())
      );
      legacyRemoved = prior.length - kept.length;
      if (legacyRemoved > 0) {
        await client.query(
          'UPDATE public.users SET fcm_tokens = $1, updated_at = NOW() WHERE id = $2',
          [kept, userId]
        );
      }
      await client.query('RELEASE SAVEPOINT fcm_invalid_legacy');
    } catch (error) {
      if (error?.code !== '42703') throw error;
      await client.query('ROLLBACK TO SAVEPOINT fcm_invalid_legacy');
      await client.query('RELEASE SAVEPOINT fcm_invalid_legacy');
    }

    await client.query('COMMIT');
    inTransaction = false;
    return { invalidated: canonical.rowCount || 0, legacyRemoved, skipped: false };
  } catch (error) {
    if (inTransaction) {
      try { await client.query('ROLLBACK'); }
      catch { /* Preserve the original failure code without exposing tokens. */ }
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { invalidateFailedFcmTokens };
