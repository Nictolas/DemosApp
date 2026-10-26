'use strict';

// Explicit, bounded, operator-triggered outbox consumer. NEVER automatically
// starts on app boot. Pending rows live in the SAME transactional PostgreSQL
// database as the GDPR ledger; this alone does not survive a total DB loss.
const { PrivacyErasureB2Journal } = require('./privacyErasureB2Journal');

class PrivacyErasureOutboxWorker {
  constructor({ env = process.env, exporter = null } = {}) {
    this.env = env;
    this.exporter = exporter || new PrivacyErasureB2Journal({ env });
  }
  validate() {
    if (this.env.GDPR_ERASURE_OUTBOX_ENABLED !== 'true' ||
        this.env.GDPR_ERASURE_OUTBOX_WORKER_ENABLED !== 'true') {
      throw Error('GDPR erasure outbox worker is disabled');
    }
    // Do not touch PostgreSQL if B2 is unavailable/misconfigured.
    this.exporter.config();
  }
  async runOnce(pool, { limit = 10 } = {}) {
    this.validate();
    if (!pool || typeof pool.connect !== 'function' ||
        !Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw Error('A PostgreSQL pool and a bounded batch of 1-20 are required');
    }
    const client = await pool.connect();
    let inTransaction = false;
    try {
      await client.query('BEGIN');
      inTransaction = true;
      // Every worker reads only pending rows; no timestamp cursor that can
      // permanently miss a concurrently committed or delayed event.
      const result = await client.query(
        'SELECT o.event_key, l.subject_user_id, l.event_type, l.occurred_at, l.details ' +
        'FROM privacy_erasure_delivery_outbox o ' +
        'JOIN privacy_erasure_ledger l ON l.event_key=o.event_key ' +
        'WHERE o.delivered_at IS NULL ' +
        'ORDER BY o.queued_at ASC, o.event_key ASC LIMIT $1 ' +
        'FOR UPDATE OF o SKIP LOCKED', [limit]
      );
      let delivered = 0;
      for (const event of result.rows) {
        // This network call happens while holding only the pending row lock.
        // A crash after B2 PUT but before COMMIT leaves the row pending;
        // B2 archiveEvent() checks the immutable same-key version on retry.
        const archived = await this.exporter.archiveEvent(event);
        if (archived.eventKey !== event.event_key ||
            !/^[0-9a-f]{64}$/.test(archived.sha256 || '') ||
            typeof archived.versionId !== 'string' ||
            archived.versionId.length === 0 ||
            archived.versionId.length > 256) {
          throw Error('Unverifiable B2 archive receipt: outbox remains pending');
        }
        const confirmed = await client.query(
          'UPDATE privacy_erasure_delivery_outbox ' +
          'SET delivered_at=NOW(), b2_version_id=$2, b2_sha256=$3 ' +
          'WHERE event_key=$1 AND delivered_at IS NULL RETURNING event_key',
          [event.event_key, archived.versionId, archived.sha256]
        );
        if (confirmed.rowCount !== 1 || confirmed.rows[0].event_key !== event.event_key) {
          throw Error('Outbox delivery marker did not match exactly one event');
        }
        delivered++;
      }
      await client.query('COMMIT');
      inTransaction = false;
      return { delivered, moreMayRemain: delivered === limit };
    } catch (error) {
      if (inTransaction) await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async status(client) {
    if (!client || typeof client.query !== 'function') throw Error('DB connection required');
    const reg = await client.query(
      "SELECT to_regclass('public.privacy_erasure_delivery_outbox') IS NOT NULL AS installed"
    );
    if (!reg.rows[0]?.installed) {
      return { installed: false, ready: false, pending: null, oldestPendingAt: null };
    }
    const counts = await client.query(
      'SELECT COUNT(*) FILTER (WHERE delivered_at IS NULL)::int AS pending, ' +
      'COUNT(*) FILTER (WHERE delivered_at IS NOT NULL AND ' +
      '(b2_version_id IS NULL OR b2_sha256 IS NULL OR ' +
      'b2_sha256 !~ \'^[0-9a-f]{64}$\'))::int AS invalid_receipts, ' +
      'MIN(queued_at) FILTER (WHERE delivered_at IS NULL) AS oldest_pending_at ' +
      'FROM privacy_erasure_delivery_outbox'
    );
    // Never infer "all exported" from an empty queue: an unbackfilled
    // historical event may have no outbox row at all.
    const missing = await client.query(
      'SELECT count(*)::int AS n FROM privacy_erasure_ledger l ' +
      'LEFT JOIN privacy_erasure_delivery_outbox o ON o.event_key=l.event_key ' +
      'WHERE o.event_key IS NULL'
    );
    const row = counts.rows[0];
    const withoutOutbox = missing.rows[0].n;
    return {
      installed: true,
      // Local readiness only. A release requires separate B2 full verification
      // and an independently pinned external completeness checkpoint.
      ready: row.pending === 0 && row.invalid_receipts === 0 && withoutOutbox === 0,
      pending: row.pending,
      unqueued: withoutOutbox,
      invalidReceipts: row.invalid_receipts,
      oldestPendingAt: row.oldest_pending_at || null
    };
  }
}
module.exports = { PrivacyErasureOutboxWorker };
