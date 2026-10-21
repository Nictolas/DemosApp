'use strict';

// Pre-production component only: not yet wired into AuditService or runtime.
// Provision and verify a private schema before any feature flag is enabled.
// No automatic database migrations or network calls are performed here.
const { randomUUID } = require('node:crypto');
const MAX_EVENT_BYTES = 2048;
const DEFAULT_MAX_ATTEMPTS = 8;

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

function createAuditOutbox({ pool, send, report = console.error, random = Math.random, maxAttempts = DEFAULT_MAX_ATTEMPTS }) {
  if (!pool || typeof pool.query !== 'function' || typeof send !== 'function') {
    throw new Error('OUTBOX_INVALID_DEPENDENCY');
  }

  async function enqueue(event, dataset) {
    assertOutboxEvent(event, dataset);
    const id = randomUUID();
    const payload = { ...event, axiom_delivery_id: id };
    const result = await pool.query(
      'INSERT INTO demos_private.audit_delivery_outbox (id, dataset, category, payload) VALUES ($1, $2, $3, $4::jsonb) RETURNING id',
      [id, dataset, event.log_type, JSON.stringify(payload)]
    );
    if (result.rowCount !== 1) throw new Error('OUTBOX_INSERT_NOT_ACKNOWLEDGED');
    return id;
  }

  async function drainOnce({ limit = 20 } = {}) {
    const batchSize = Math.max(1, Math.min(50, Number(limit) || 20));
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

  return { enqueue, drainOnce };
}

module.exports = { MAX_EVENT_BYTES, assertOutboxEvent, nextDelayMs, createAuditOutbox };
