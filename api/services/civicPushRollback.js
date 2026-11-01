'use strict';

const { lockCivicPushDuringAccountErasure } = require('./civicPushDeliveryGuard');

/**
 * Emergency stop is safe by default. No FCM calls, no token reads, no
 * preference changes and no changes to sent/dispatching records.
 *
 * APPLY takes the same PostgreSQL advisory lock as any in-flight dispatch.
 * It blocks new deliveries and permanently suppresses pending events in one
 * transaction. Collectors also respect reason_code=EMERGENCY_STOP.
 */
async function stopCivicPush(pool, {
  apply = false,
  confirmed = false,
} = {}) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('CIVIC_POOL_REQUIRED');
  if (apply && confirmed !== true) throw new Error('CIVIC_ROLLBACK_CONFIRMATION_REQUIRED');

  const db = await pool.connect();
  let txOpen = false;
  let discard = false;
  try {
    await db.query('BEGIN');
    txOpen = true;
    await lockCivicPushDuringAccountErasure(db);
    const gate = await db.query(
      'SELECT blocked, reason_code FROM civic_push_delivery_guard WHERE id = 1 FOR UPDATE'
    );
    if (gate.rows.length !== 1) throw new Error('CIVIC_DELIVERY_GUARD_NOT_INITIALIZED');

    const counts = await db.query(`
      SELECT status, COUNT(*)::integer AS total
      FROM civic_new_initiative_notifications
      GROUP BY status
    `);
    const pending = counts.rows.find(row => row.status === 'pending')?.total || 0;

    if (!apply) {
      await db.query('ROLLBACK');
      txOpen = false;
      return {
        dryRun: true, guardCurrentlyBlocked: gate.rows[0].blocked,
        wouldSuppressPending: Number(pending),
      };
    }

    // This guard update makes new events suppressed as well. No automatic
    // re-enable exists anywhere: an authorized manual procedure is required.
    const update = await db.query(`
      UPDATE civic_push_delivery_guard
      SET blocked = TRUE,
          reason_code = 'EMERGENCY_STOP',
          updated_at = NOW()
      WHERE id = 1
      RETURNING id
    `);
    if (update.rows.length !== 1) throw new Error('CIVIC_ROLLBACK_GUARD_UPDATE_FAILED');

    const suppressed = await db.query(`
      UPDATE civic_new_initiative_notifications
      SET status = 'suppressed',
          last_error_code = 'EMERGENCY_STOP'
      WHERE status = 'pending'
      RETURNING id
    `);

    await db.query('COMMIT');
    txOpen = false;
    return {
      dryRun: false, guardBlocked: true,
      suppressedPending: suppressed.rowCount ?? suppressed.rows.length,
      pendingRequiresReview: 0,
      // "dispatching" events may already have been accepted by FCM.
      // They are never retried automatically after a rollback.
    };
  } catch {
    if (txOpen) {
      try {
        await db.query('ROLLBACK');
        txOpen = false;
      } catch {
        discard = true;
      }
    }
    throw new Error('CIVIC_ROLLBACK_UNAVAILABLE');
  } finally {
    // Unknown transaction state must never return to the shared pool.
    db.release(discard || txOpen);
  }
}

module.exports = { stopCivicPush };
