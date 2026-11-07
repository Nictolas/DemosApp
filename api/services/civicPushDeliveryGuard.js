'use strict';

// Shared session/transaction advisory lock serializes topic delivery with account
// erasure. It prevents a NEW topic send from starting after erasure commits.
// FCM messages accepted earlier cannot be recalled from device queues.
const ADVISORY_LOCK = '60423, 539';
const { assertCivicDatabaseIdentity } = require('./civicRuntimeDatabaseIdentity');
const { assertCivicSessionLockCompatible } = require('./civicSessionLockSafety');

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
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.is_active = TRUE
        AND COALESCE(u.status, '') <> 'a'
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
  // A transaction-pooler connection cannot retain this session lock between
  // acquisition, FCM/network work and subsequent unlock queries.
  // Fail closed *before* taking any lock or sending a push.
  assertCivicSessionLockCompatible();
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

/**
 * Serialize all topic-affecting writes (preferences, token rotation, logout)
 * with bootstrap, dispatch and account erasure. Use the held client for every
 * query in the callback: a second pooled connection can deadlock at poolSize=1.
 * With push OFF, retain existing no-Firebase behavior without extra DB reads.
 */
async function withCivicPushDeliveryLock(pool, callback, { enabled = false } = {}) {
  if (typeof callback !== 'function') throw new TypeError('CIVIC_LOCK_CALLBACK_REQUIRED');
  if (!enabled) return callback(pool);
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('CIVIC_LOCK_POOL_REQUIRED');
  const client = await pool.connect();
  let attempted = false;
  let locked = false;
  let discard = false;
  try {
    attempted = true;
    await acquireCivicPushDeliveryLock(client);
    locked = true;
    // Topic mutations must not operate on a different/unknown database.
    await assertCivicDatabaseIdentity(client);
    return await callback(client);
  } finally {
    if (locked) {
      try {
        await releaseCivicPushDeliveryLock(client);
      } catch {
        discard = true;
      }
    } else if (attempted) {
      // Unknown lock acquisition outcome: never return this session to pool.
      discard = true;
    }
    client.release(discard);
  }
}

module.exports = {
  readCivicDeliveryBarrier,
  blockCivicDeliveryOnRevocationFailure,
  blockCivicDeliveryFromPool,
  lockCivicPushDuringAccountErasure,
  acquireCivicPushDeliveryLock,
  releaseCivicPushDeliveryLock,
  withCivicPushDeliveryLock,
};
