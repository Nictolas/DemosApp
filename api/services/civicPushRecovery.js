'use strict';

const { lockCivicPushDuringAccountErasure } = require('./civicPushDeliveryGuard');

/**
 * Recovery PREPARATION only; never authorizes or sends FCM messages.
 * The delivery guard stays blocked even after explicit APPLY.
 * Requires a separate approved release/canary procedure to ever unblock.
 *
 * No automatic retry for failed/dispatching; no rollback of suppressed rows.
 * All decisions are made under the same DB advisory lock used for delivery.
 */
async function prepareCivicPushRecovery(pool, {
  apply = false,
  confirmed = false,
} = {}) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('CIVIC_POOL_REQUIRED');
  if (apply && !confirmed) throw new Error('CIVIC_RECOVERY_CONFIRMATION_REQUIRED');

  const db = await pool.connect();
  let transactionOpen = false;
  let discard = false;
  try {
    await db.query('BEGIN');
    transactionOpen = true;
    await lockCivicPushDuringAccountErasure(db);
    const guard = await db.query(
      'SELECT blocked, reason_code FROM civic_push_delivery_guard WHERE id = 1 FOR UPDATE'
    );
    if (guard.rows.length !== 1 || guard.rows[0].blocked !== true) {
      throw new Error('CIVIC_RECOVERY_REQUIRES_BLOCKED_GUARD');
    }
    if (!['EMERGENCY_STOP', 'RECOVERY_HOLD'].includes(guard.rows[0].reason_code)) {
      throw new Error('CIVIC_RECOVERY_INVALID_GUARD_STATE');
    }

    const stats = await db.query(`
      SELECT status, COUNT(*)::integer AS total
      FROM civic_new_initiative_notifications
      GROUP BY status
    `);
    const count = Object.fromEntries(stats.rows.map(row => [row.status, Number(row.total)]));
    const pending = count.pending || 0;
    const uncertain = (count.failed || 0) + (count.dispatching || 0);
    const ready = pending === 0 && uncertain === 0;

    if (!apply || !ready) {
      await db.query('ROLLBACK');
      transactionOpen = false;
      return {
        dryRun: !apply,
        prepared: false,
        guardBlocked: true,
        pendingToSuppress: pending,
        uncertainEventsForManualReview: uncertain,
        readyForPreparation: ready,
      };
    }

    // RECOVERY_HOLD is an intermediate blocking state. Collectors must keep
    // suppressing all new initiatives until a separately authorized rollout.
    const changed = await db.query(`
      UPDATE civic_push_delivery_guard
      SET blocked = TRUE, reason_code = 'RECOVERY_HOLD', updated_at = NOW()
      WHERE id = 1 AND blocked = TRUE
      RETURNING id
    `);
    if (changed.rows.length !== 1) throw new Error('CIVIC_RECOVERY_GUARD_UPDATE_FAILED');

    await db.query('COMMIT');
    transactionOpen = false;
    return {
      dryRun: false, prepared: true, guardBlocked: true,
      pendingToSuppress: 0, uncertainEventsForManualReview: 0,
      readyForPreparation: true,
    };
  } catch {
    if (transactionOpen) {
      try {
        await db.query('ROLLBACK');
        transactionOpen = false;
      } catch {
        discard = true;
      }
    }
    throw new Error('CIVIC_RECOVERY_UNAVAILABLE');
  } finally {
    db.release(discard || transactionOpen);
  }
}

module.exports = { prepareCivicPushRecovery };
