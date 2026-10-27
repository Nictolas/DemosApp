'use strict';

// Explicit, bounded, operator-triggered outbox consumer. NEVER automatically
// starts on app boot. Pending rows live in the SAME transactional PostgreSQL
// database as the GDPR ledger; this alone does not survive a total DB loss.
const crypto = require('node:crypto');
const { PrivacyErasureB2Journal, normalizeEvent, keyFor } = require('./privacyErasureB2Journal');
const Ledger = require('./privacyErasureLedgerService');

// Identical fail-closed switch semantics to the recovery middleware, but this
// worker is isolated from the legacy HTTP entrypoint and never starts itself.
function isPrivacyRecoveryMaintenanceActive(env) {
  const mode = env?.DEMOS_PRIVACY_RECOVERY_MAINTENANCE;
  return mode !== undefined && mode !== 'false';
}

class PrivacyErasureOutboxWorker {
  constructor({ env = process.env, exporter = null } = {}) {
    this.env = env;
    this.exporter = exporter || new PrivacyErasureB2Journal({ env });
  }
  // Local defence-in-depth only. An environment variable does not prove
  // that OTHER Render instances, Supabase Data API or workers are isolated.
  // An authorized offline recovery exporter needs a separate reviewed
  // procedure; never add an environment-only bypass here.
  assertNotInRecovery() {
    if (isPrivacyRecoveryMaintenanceActive(this.env)) {
      throw Error('GDPR outbox worker blocked during recovery maintenance');
    }
  }
  validate() {
    // Apply the same fail-closed semantics as the HTTP maintenance middleware,
    // before exporter configuration, PostgreSQL or any network calls.
    this.assertNotInRecovery();
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
      // A borrowed pool client may have a hostile search_path or pg_temp
      // shadow tables. Pin the same public ledger/outbox that the recovery
      // checks verify, for this transaction only (no persistent DB changes).
      await client.query('SET LOCAL search_path = pg_catalog, public, pg_temp');
      // The maintenance switch may have changed while acquiring a client.
      this.assertNotInRecovery();
      // The operator must not run delivery using a table owner or a role
      // able to bypass RLS; otherwise an accidentally misconfigured pool
      // would quietly circumvent the fixture/runtime security boundary.
      const identity = await client.query(`
        SELECT current_user AS sql_role, r.rolbypassrls AS bypass_rls,
          r.rolsuper AS superuser,
          (SELECT c.relowner = r.oid FROM pg_catalog.pg_class c
           WHERE c.oid = 'public.privacy_erasure_ledger'::regclass)
            AS owns_ledger,
          (SELECT c.relowner = r.oid FROM pg_catalog.pg_class c
           WHERE c.oid = 'public.privacy_erasure_delivery_outbox'::regclass)
            AS owns_outbox
        FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
      `);
      const role = identity.rows?.[0];
      if (!role || role.bypass_rls !== false || role.superuser !== false ||
          role.owns_ledger !== false || role.owns_outbox !== false) {
        throw Error('GDPR_OUTBOX_WORKER_UNSAFE_SQL_ROLE');
      }
      await Ledger.assertProtectedLedger(client);
      await Ledger.assertProtectedOutbox(client);
      // Every worker reads only pending rows; no timestamp cursor that can
      // permanently miss a concurrently committed or delayed event.
      const result = await client.query(
        'SELECT o.event_key, l.subject_user_id, l.event_type, ' +
        "to_char(l.occurred_at AT TIME ZONE 'UTC', " +
        `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at, ` +
        'l.details ' +
        'FROM public.privacy_erasure_delivery_outbox o ' +
        'JOIN public.privacy_erasure_ledger l ON l.event_key=o.event_key ' +
        'WHERE o.delivered_at IS NULL ' +
        'ORDER BY o.queued_at ASC, o.event_key ASC LIMIT $1 ' +
        'FOR UPDATE OF o SKIP LOCKED', [limit]
      );
      let delivered = 0;
      for (const event of result.rows) {
        // A switch while selecting rows must stop BEFORE issuing B2 PUT.
        this.assertNotInRecovery();
        // This network call happens while holding only the pending row lock.
        // A crash after B2 PUT but before COMMIT leaves the row pending;
        // B2 archiveEvent() checks the immutable same-key version on retry.
        const archived = await this.exporter.archiveEvent(event);
        // A recovery switch can occur during the remote readback/PUT.
        // In that case leave the delivery row pending in PostgreSQL; a
        // later approved retry can reuse the exact immutable B2 version.
        this.assertNotInRecovery();
        // Rebind the returned receipt to the exact JSONB event selected from
        // this transaction. Do not acknowledge a wrong version/hash merely
        // because an exporter plugin returned syntactically valid strings.
        const canonical = normalizeEvent(event);
        const expectedSha = crypto.createHash('sha256')
          .update(JSON.stringify(canonical)).digest('hex');
        const until = archived?.retentionUntil;
        const expiry = typeof until === 'string' ? new Date(until) : null;
        if (archived?.eventKey !== event.event_key ||
            archived?.key !== keyFor(canonical) ||
            archived?.sha256 !== expectedSha ||
            typeof archived?.versionId !== 'string' ||
            archived.versionId.length === 0 ||
            archived.versionId.length > 256 ||
            !expiry || !Number.isFinite(expiry.getTime()) ||
            expiry.toISOString() !== until || expiry <= new Date()) {
          throw Error('Unverifiable B2 archive receipt: outbox remains pending');
        }
        const confirmed = await client.query(
          'UPDATE public.privacy_erasure_delivery_outbox ' +
          'SET delivered_at=NOW(), b2_version_id=$2, b2_sha256=$3 ' +
          'WHERE event_key=$1 AND delivered_at IS NULL RETURNING event_key',
          [event.event_key, archived.versionId, archived.sha256]
        );
        if (confirmed.rowCount !== 1 || confirmed.rows[0].event_key !== event.event_key) {
          throw Error('Outbox delivery marker did not match exactly one event');
        }
        delivered++;
      }
      // Recheck before committing the entire batch; an external switch
      // between this check and COMMIT still requires infrastructure freeze.
      this.assertNotInRecovery();
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
      'FROM public.privacy_erasure_delivery_outbox'
    );
    // Never infer "all exported" from an empty queue: an unbackfilled
    // historical event may have no outbox row at all.
    const missing = await client.query(
      'SELECT count(*)::int AS n FROM public.privacy_erasure_ledger l ' +
      'LEFT JOIN public.privacy_erasure_delivery_outbox o ON o.event_key=l.event_key ' +
      'WHERE o.event_key IS NULL'
    );
    // An outbox-only row can be a trace of a lost ledger event after an
    // incomplete/legacy restore. A zero-pending summary must not hide it.
    const orphaned = await client.query(
      'SELECT COUNT(*)::int AS n FROM public.privacy_erasure_delivery_outbox o ' +
      'WHERE NOT EXISTS (' +
      'SELECT 1 FROM public.privacy_erasure_ledger l WHERE l.event_key=o.event_key)'
    );
    const row = counts.rows[0];
    const withoutOutbox = missing.rows[0].n;
    const withoutLedger = orphaned.rows[0]?.n;
    return {
      installed: true,
      // Local readiness only. A release requires separate B2 full verification
      // and an independently pinned external completeness checkpoint.
      ready: row.pending === 0 && row.invalid_receipts === 0 &&
        withoutOutbox === 0 && withoutLedger === 0,
      pending: row.pending,
      unqueued: withoutOutbox,
      orphaned: withoutLedger,
      invalidReceipts: row.invalid_receipts,
      oldestPendingAt: row.oldest_pending_at || null
    };
  }
}
module.exports = { PrivacyErasureOutboxWorker };
