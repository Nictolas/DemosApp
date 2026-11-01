'use strict';

// Shared session/transaction advisory lock serializes topic delivery with account
// erasure. It prevents a NEW topic send from starting after erasure commits.
// FCM messages accepted earlier cannot be recalled from device queues.
const ADVISORY_LOCK = '60423, 539';

async function readCivicDeliveryBarrier(client) {
  const result = await client.query(
    'SELECT blocked FROM civic_push_delivery_guard WHERE id = 1'
  );
  if (result.rows.length !== 1 || result.rows[0].blocked !== false) {
    return { blocked: true, reason: 'CIVIC_DELIVERY_GUARD_BLOCKED' };
  }
  // Active devices whose owners are now inactive must never receive topic sends.
  // Any such device indicates that a topic revocation may still be needed.
  const inactive = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM user_devices d
      JOIN users u ON u.id = d.user_id
      WHERE d.is_active = TRUE AND u.status <> 'a'
      LIMIT 1
    ) AS unsafe
  `);
  return {
    blocked: inactive.rows.length !== 1 || inactive.rows[0].unsafe !== false,
    reason: 'CIVIC_DELIVERY_GUARD_BLOCKED',
  };
}

async function blockCivicDeliveryOnRevocationFailure(client) {
  const changed = await client.query(`
    UPDATE civic_push_delivery_guard
    SET blocked = TRUE,
        reason_code = 'REVOCATION_UNCERTAIN',
        updated_at = NOW()
    WHERE id = 1
    RETURNING id
  `);
  if (changed.rows.length !== 1) {
    throw new Error('CIVIC_DELIVERY_GUARD_NOT_INITIALIZED');
  }
}

async function lockCivicPushDuringAccountErasure(client) {
  await client.query(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK})`);
}

async function acquireCivicPushDeliveryLock(client) {
  await client.query(`SELECT pg_advisory_lock(${ADVISORY_LOCK})`);
}

async function releaseCivicPushDeliveryLock(client) {
  const result = await client.query(
    `SELECT pg_advisory_unlock(${ADVISORY_LOCK}) AS unlocked`
  );
  if (result.rows.length !== 1 || result.rows[0].unlocked !== true) {
    throw new Error('CIVIC_DELIVERY_LOCK_RELEASE_FAILED');
  }
}

/**
 * Globally stop NEW topic sends after an uncertain unsubscribe on logout,
 * device change or user opt-out. The lock waits for an in-flight send to
 * complete; failed delivery cannot be silently treated as a successful revoke.
 */
async function blockCivicDeliveryFromPool(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockCivicPushDuringAccountErasure(client);
    await blockCivicDeliveryOnRevocationFailure(client);
    await client.query('COMMIT');
  } catch {
    try { await client.query('ROLLBACK'); } catch { /* connection already broken */ }
    throw new Error('CIVIC_DELIVERY_BLOCK_FAILED');
  } finally {
    client.release();
  }
}

module.exports = {
  readCivicDeliveryBarrier,
  blockCivicDeliveryOnRevocationFailure,
  blockCivicDeliveryFromPool,
  lockCivicPushDuringAccountErasure,
  acquireCivicPushDeliveryLock,
  releaseCivicPushDeliveryLock,
};
