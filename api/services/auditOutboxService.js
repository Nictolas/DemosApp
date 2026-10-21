'use strict';

// Pre-production feature: code wired behind opt-in flags, NOT enabled on live.
// Provision and verify a private schema before any feature flag is enabled.
// No automatic schema migration or log deletion is performed here.
const { randomUUID } = require('node:crypto');
const MAX_EVENT_BYTES = 2048;
const DEFAULT_MAX_ATTEMPTS = 8;
// Enforced under a transaction-scoped advisory lock across all app instances.
// This bound includes dead-letter records (no automatic deletion of audit data).
const DEFAULT_MAX_RECORDS = 5000;
const MAX_CONFIGURED_RECORDS = 10000;
const OUTBOX_CAPACITY_LOCK_ID = 730218;

function resolveMaxRecords(value = process.env.AUDIT_OUTBOX_MAX_RECORDS) {
  if (value === undefined || value === null || value === '') return DEFAULT_MAX_RECORDS;
  if (!/^[0-9]+$/.test(String(value))) throw new Error('OUTBOX_INVALID_CAPACITY');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_CONFIGURED_RECORDS) {
    throw new Error('OUTBOX_INVALID_CAPACITY');
  }
  return n;
}

function assertOutboxEvent(event, dataset) {
  if (!event || typeof event !== 'object' || !['audit', 'security'].includes(event.log_type)) {
    throw new Error('OUTBOX_INVALID_CATEGORY');
  }
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(String(dataset || ''))) {
    throw new Error('OUTBOX_INVALID_DATASET');
  }
  if (Buffer.byteLength(JSON.stringify(event), 'utf8') > MAX_EVENT_BYTES) {
    throw new Error('OUTBOX_EVENT_TOO_LARGE');
  }
}

function nextDelayMs(attempts, random = Math.random) {
  const base = Math.min(60 * 60 * 1000, 15000 * 2 ** Math.min(8, Math.max(0, attempts - 1)));
  return Math.floor(base * (0.8 + Math.max(0, Math.min(1, random())) * 0.4));
}

function createAuditOutbox({
  pool, send, ensureReady = async () => {}, report = console.error,
  random = Math.random, maxAttempts = DEFAULT_MAX_ATTEMPTS,
  maxRecords = resolveMaxRecords()
}) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function' ||
      typeof send !== 'function' || typeof ensureReady !== 'function') {
    throw new Error('OUTBOX_INVALID_DEPENDENCY');
  }
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > MAX_CONFIGURED_RECORDS) {
    throw new Error('OUTBOX_INVALID_CAPACITY');
  }
  let lastCapacityAlertMs = -Infinity;

  async function enqueue(event, dataset) {
    await ensureReady();
    assertOutboxEvent(event, dataset);
    const id = randomUUID();
    const payload = { ...event, axiom_delivery_id: id };
    // Enforce the bound on the full persisted payload, including deduplication ID.
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_EVENT_BYTES) {
      throw new Error('OUTBOX_EVENT_TOO_LARGE');
    }
    // A transaction-scoped advisory lock serializes capacity checks across
    // independently connected workers. The COUNT occurs after acquiring the
    // lock, under READ COMMITTED, so two enqueues cannot both see the last slot.
    const client = await pool.connect();
    let inTransaction = false;
    try {
      await client.query('BEGIN');
      inTransaction = true;
      await client.query('SELECT pg_advisory_xact_lock($1::integer)', [OUTBOX_CAPACITY_LOCK_ID]);
      const occupancy = await client.query(
        'SELECT COUNT(*)::integer AS total FROM demos_private.audit_delivery_outbox'
      );
      if (!occupancy.rows?.length) throw new Error('OUTBOX_CAPACITY_UNAVAILABLE');
      if (Number(occupancy.rows[0].total) >= maxRecords) {
        // Rate limit independent of Axiom: prevent repeated failed writes from
        // generating a second log-cost incident in the Render collector.
        const nowMs = Date.now();
        if (nowMs - lastCapacityAlertMs >= 60 * 60 * 1000) {
          report('AUDIT_OUTBOX_AT_CAPACITY', { capacity: maxRecords });
          lastCapacityAlertMs = nowMs;
        }
        throw new Error('OUTBOX_CAPACITY_EXCEEDED');
      }
      const result = await client.query(
        'INSERT INTO demos_private.audit_delivery_outbox (id, dataset, category, payload) VALUES ($1, $2, $3, $4::jsonb) RETURNING id',
        [id, dataset, event.log_type, JSON.stringify(payload)]
      );
      if (result.rowCount !== 1) throw new Error('OUTBOX_INSERT_NOT_ACKNOWLEDGED');
      await client.query('COMMIT');
      inTransaction = false;
      return id;
    } catch (error) {
      if (inTransaction) {
        // Never leak SQL driver errors or payload contents into Render logs.
        await client.query('ROLLBACK').catch(() => {});
      }
      throw error;
    } finally {
      client.release();
    }
  }

  // Counts and ages only. The event payload and identifiers never leave SQL.
  async function getHealth() {
    await ensureReady();
    const result = await pool.query(`
      SELECT COUNT(*)::integer AS total,
             COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending,
             COUNT(*) FILTER (WHERE status = 'sending')::integer AS sending,
             COUNT(*) FILTER (WHERE status = 'dead_letter')::integer AS dead_letter,
             COALESCE(EXTRACT(EPOCH FROM (
               NOW() - MIN(created_at) FILTER (WHERE status IN ('pending', 'sending'))
             ))::integer, 0) AS oldest_wait_seconds
      FROM demos_private.audit_delivery_outbox`);
    if (result.rows?.length !== 1) throw new Error('OUTBOX_HEALTH_UNAVAILABLE');
    const values = result.rows[0];
    const totals = {
      total: Number(values.total),
      pending: Number(values.pending),
      sending: Number(values.sending),
      deadLetter: Number(values.dead_letter),
      oldestWaitSeconds: Math.max(0, Number(values.oldest_wait_seconds)),
      capacity: maxRecords
    };
    if (Object.values(totals).some(v => !Number.isSafeInteger(v) || v < 0) ||
        totals.total !== totals.pending + totals.sending + totals.deadLetter ||
        totals.total > maxRecords) {
      throw new Error('OUTBOX_HEALTH_INVALID');
    }
    return totals;
  }

  // 90-second leases must outlast a whole sequential HTTP batch.
  // Axiom requests use a five-second timeout; cap at 10 claims (<=50s of HTTP).
  async function drainOnce({ limit = 10 } = {}) {
    await ensureReady();
    const batchSize = Math.max(1, Math.min(10, Number(limit) || 10));
    const leaseId = randomUUID();
    const result = await pool.query(
      `WITH due AS (
        SELECT id FROM demos_private.audit_delivery_outbox
        WHERE (status = 'pending' AND next_attempt_at <= NOW())
           OR (status = 'sending' AND lease_expires_at < NOW())
        ORDER BY next_attempt_at, created_at
        LIMIT $1 FOR UPDATE SKIP LOCKED
      )
      UPDATE demos_private.audit_delivery_outbox AS o
      SET status = 'sending',
          lease_id = $2,
          lease_expires_at = NOW() + INTERVAL '90 seconds',
          attempt_count = o.attempt_count + 1
      FROM due WHERE o.id = due.id
      RETURNING o.id, o.dataset, o.payload, o.attempt_count`,
      [batchSize, leaseId]
    );
    const claimed = result.rows || [];
    let delivered = 0, rescheduled = 0, deadLettered = 0;

    for (const item of claimed) {
      let ok = false;
      try {
        ok = (await send(item.dataset, item.payload)) === true;
      } catch (_error) {
        ok = false;
      }

      if (ok) {
        const ack = await pool.query(
          `DELETE FROM demos_private.audit_delivery_outbox
           WHERE id = $1 AND lease_id = $2 AND status = 'sending'`,
          [item.id, leaseId]
        );
        if (ack.rowCount === 1) delivered++;
        else report('AUDIT_OUTBOX_ACK_STALE');
      } else {
        const dead = item.attempt_count >= maxAttempts;
        const delay = nextDelayMs(item.attempt_count, random);
        const retry = await pool.query(
          `UPDATE demos_private.audit_delivery_outbox
           SET status = $3, next_attempt_at = NOW() + ($4::integer * INTERVAL '1 millisecond'),
               lease_id = NULL, lease_expires_at = NULL
           WHERE id = $1 AND lease_id = $2 AND status = 'sending'`,
          [item.id, leaseId, dead ? 'dead_letter' : 'pending', delay]
        );
        if (retry.rowCount === 1) {
          if (dead) deadLettered++;
          else rescheduled++;
        } else {
          report('AUDIT_OUTBOX_RETRY_STALE');
        }
      }
    }
    if (deadLettered) report('AUDIT_OUTBOX_DEAD_LETTER', { count: deadLettered });
    return { claimed: claimed.length, delivered, rescheduled, deadLettered };
  }

  return { enqueue, drainOnce, getHealth };
}

module.exports = {
  MAX_EVENT_BYTES, DEFAULT_MAX_RECORDS, resolveMaxRecords,
  assertOutboxEvent, nextDelayMs, createAuditOutbox
};
