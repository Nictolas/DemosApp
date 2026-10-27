'use strict';

// DRAFT: explicitly invoked, quarantined/offline recovery component.
// Deliberately NO CLI, HTTP route, app bootstrap, scheduler or env-only bypass
// of the normal outbox worker's recovery-maintenance gate.
const crypto = require('node:crypto');
const {PrivacyErasureB2Journal, normalizeEvent: normalizeB2Event} =
  require('./privacyErasureB2Journal');
const {
  normalizeEvent, verifySignedManifest, assertIndependentRecoveryCheckpoint
} = require('./privacyRecoveryGateService');

class PrivacyOfflineRecoveryExporter {
  constructor({env = process.env, exporter = null, clock = () => new Date()} = {}) {
    this.env = env;
    this.exporter = exporter || new PrivacyErasureB2Journal({env, clock});
    this.clock = clock;
  }

  assertQuarantine() {
    // This is a local defence-in-depth check, NOT evidence that all Render
    // instances, Supabase Data API and other DB writers are isolated.
    if (this.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE !== 'true' ||
        this.env.GDPR_ERASURE_OUTBOX_ENABLED !== 'true' ||
        this.env.GDPR_ERASURE_RECOVERY_OFFLINE_EXPORT_ENABLED !== 'true' ||
        (this.env.GDPR_ERASURE_OUTBOX_WORKER_ENABLED !== undefined &&
         this.env.GDPR_ERASURE_OUTBOX_WORKER_ENABLED !== 'false')) {
      throw Error('Offline GDPR export requires explicit quarantine and ordinary worker disabled');
    }
  }

  async runOnce(pool, {
    envelope, secret, expectedRecoveryId, expectedManifestDigest,
    expectedRestoredBackupTakenAt, expectedCapturedAt,
    maintenanceConfirmed = false, quarantineConfirmed = false,
    limit = 10
  } = {}) {
    this.assertQuarantine();
    if (maintenanceConfirmed !== true || quarantineConfirmed !== true) {
      throw Error('Offline GDPR export requires independent operator quarantine attestation');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw Error('Offline GDPR export requires bounded batch of 1-20');
    }
    // The approved pin MUST be supplied independently of the signed envelope.
    // An HMAC authenticates a manifest but does not prove it is the newest.
    const approved = verifySignedManifest(envelope, secret, expectedRecoveryId);
    assertIndependentRecoveryCheckpoint(envelope, {
      expectedManifestDigest, expectedRestoredBackupTakenAt, expectedCapturedAt
    });
    if (!pool || typeof pool.connect !== 'function' ||
        typeof this.exporter.config !== 'function' ||
        typeof this.exporter.archiveEvent !== 'function') {
      throw Error('Dedicated PostgreSQL pool and B2 exporter are required');
    }
    this.assertQuarantine();
    this.exporter.config(); // B2 configuration preflight before PostgreSQL.
    this.assertQuarantine();

    const client = await pool.connect(); // dedicated client, never pool.query
    let open = false;
    try {
      this.assertQuarantine();
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      open = true;
      // All preflight checks target public explicitly. A borrowed SQL
      // connection may carry a caller-controlled search_path or pg_temp
      // shadow relations. Pin ledger/outbox and all downstream queries to
      // the verified schema for THIS transaction, restoring it on exit.
      await client.query('SET LOCAL search_path = pg_catalog, public, pg_temp');
      // Acquire the shared recovery advisory lock BEFORE relation locks.
      // The signed ledger replay acquires this advisory lock first and then
      // writes the same tables. Reversing the order here can deadlock:
      // offline exporter holds relation locks while waiting for replay's
      // advisory lock, while replay waits for those relation locks.
      await client.query('SELECT pg_advisory_xact_lock(170026, 296)');
      // Fail closed if ANY other transaction is writing ledger/outbox.
      // Keep relation locks until COMMIT/ROLLBACK, avoiding a changing
      // snapshot between validation and B2 PUT. NOWAIT refuses uncoordinated
      // writers rather than waiting behind them. These SQL locks do NOT
      // attest to a full provider-level Render/Supabase quarantine.
      await client.query(
        'LOCK TABLE privacy_erasure_ledger, privacy_erasure_delivery_outbox ' +
        'IN SHARE ROW EXCLUSIVE MODE NOWAIT'
      );
      const schema = await client.query(
        "SELECT to_regclass('public.privacy_erasure_ledger') IS NOT NULL AS ledger, " +
        "to_regclass('public.privacy_erasure_delivery_outbox') IS NOT NULL AS outbox"
      );
      if (schema.rows[0]?.ledger !== true || schema.rows[0]?.outbox !== true) {
        throw Error('Offline GDPR export requires preinstalled ledger and outbox');
      }

      // Compare ALL ledger contents, including previously delivered events,
      // to the independently approved manifest BEFORE the first B2 PUT.
      // Key/count-only checks would miss a modified delivered event with the
      // same UUID; checking only pending rows is insufficient. Read in pages
      // to avoid fetching up to 100k sensitive events in a single SQL result.
      // The table locks + REPEATABLE READ hold the verified history stable.
      const unseen = new Map(approved.events.map(e => [e.event_key, e]));
      let cursor = '';
      for (;;) {
        this.assertQuarantine();
        const page = await client.query(
          'SELECT event_key, subject_user_id, event_type, ' +
          "to_char(occurred_at AT TIME ZONE 'UTC', " +
        `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at, ` +
          'details ' +
          'FROM privacy_erasure_ledger ' +
          'WHERE event_key > $1 ORDER BY event_key ASC LIMIT $2',
          [cursor, 250]
        );
        if (page.rows.length === 0) break;
        for (const row of page.rows) {
          const expected = unseen.get(row.event_key);
          if (!expected) {
            throw Error('Restored GDPR ledger contains events outside approved manifest');
          }
          if (JSON.stringify(normalizeEvent(row)) !== JSON.stringify(expected)) {
            throw Error('Restored GDPR ledger event differs from approved external manifest');
          }
          unseen.delete(row.event_key);
          cursor = row.event_key;
        }
      }
      if (unseen.size !== 0) {
        throw Error('Restored GDPR ledger missing approved external events');
      }
      const outboxIntegrity = await client.query(
        'SELECT EXISTS (' +
        ' SELECT 1 FROM privacy_erasure_ledger l ' +
        ' LEFT JOIN privacy_erasure_delivery_outbox o ON o.event_key=l.event_key ' +
        ' WHERE o.event_key IS NULL' +
        ' UNION ALL ' +
        ' SELECT 1 FROM privacy_erasure_delivery_outbox o ' +
        ' WHERE NOT EXISTS (' +
        ' SELECT 1 FROM privacy_erasure_ledger l WHERE l.event_key=o.event_key' +
        ' )) AS present'
      );
      if (outboxIntegrity.rows[0]?.present !== false) {
        throw Error('Offline GDPR export refuses missing or orphaned outbox evidence');
      }

      this.assertQuarantine();
      const pending = await client.query(
        'SELECT o.event_key, l.subject_user_id, l.event_type, ' +
        "to_char(l.occurred_at AT TIME ZONE 'UTC', " +
        `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at, ` +
        'l.details ' +
        'FROM privacy_erasure_delivery_outbox o ' +
        'JOIN privacy_erasure_ledger l ON l.event_key=o.event_key ' +
        'WHERE o.delivered_at IS NULL ' +
        'ORDER BY o.queued_at ASC, o.event_key ASC LIMIT $1 ' +
        'FOR UPDATE OF o SKIP LOCKED', [limit]
      );
      // The complete ledger was already checked under transaction-scoped
      // table locks; keep the per-pending-row comparison as a final guard.
      const expectedByKey = new Map(approved.events.map(e => [e.event_key, e]));
      let delivered = 0;
      let earliestRetentionUntil = null;
      for (const event of pending.rows) {
        this.assertQuarantine();
        const expected = expectedByKey.get(event.event_key);
        if (!expected || JSON.stringify(normalizeEvent(event)) !==
            JSON.stringify(expected)) {
          throw Error('Offline GDPR export event differs from approved external manifest');
        }
        const normalized = normalizeB2Event(event);
        const expectedSha = crypto.createHash('sha256')
          .update(JSON.stringify(normalized)).digest('hex');
        const receipt = await this.exporter.archiveEvent(event);
        this.assertQuarantine();
        if (receipt?.eventKey !== event.event_key ||
            receipt?.sha256 !== expectedSha ||
            typeof receipt?.versionId !== 'string' ||
            receipt.versionId.length === 0 || receipt.versionId.length > 256) {
          throw Error('Offline GDPR export returned invalid immutable receipt');
        }
        const until = typeof receipt.retentionUntil === 'string'
          ? new Date(receipt.retentionUntil) : null;
        const now = this.clock();
        if (!(now instanceof Date) || !Number.isFinite(now.getTime()) ||
            !until || !Number.isFinite(until.getTime()) ||
            until.toISOString() !== receipt.retentionUntil || until <= now) {
          throw Error('Offline GDPR export receipt has no valid COMPLIANCE retention');
        }
        if (!earliestRetentionUntil || until < earliestRetentionUntil) {
          earliestRetentionUntil = until;
        }
        const updated = await client.query(
          'UPDATE privacy_erasure_delivery_outbox ' +
          'SET delivered_at=NOW(), b2_version_id=$2, b2_sha256=$3 ' +
          'WHERE event_key=$1 AND delivered_at IS NULL RETURNING event_key',
          [event.event_key,receipt.versionId,receipt.sha256]
        );
        if (updated.rowCount !== 1 ||
            updated.rows[0]?.event_key !== event.event_key) {
          throw Error('Offline GDPR export could not atomically confirm receipt');
        }
        delivered++;
      }
      this.assertQuarantine();
      const finishedAt = this.clock();
      if (!(finishedAt instanceof Date) || !Number.isFinite(finishedAt.getTime()) ||
          (earliestRetentionUntil && earliestRetentionUntil <= finishedAt)) {
        throw Error('Offline GDPR export retention expired before commit');
      }
      await client.query('COMMIT');
      open = false;
      // The local flag may change while COMMIT runs. A post-commit check
      // cannot undo durable SQL/B2 effects, but must refuse ordinary success
      // if authorization was revoked during that interval. Reconcile first.
      this.assertQuarantine();
      // Not recovery readiness: a complete separately pinned B2 readback is
      // still required, with an independently demonstrated writer freeze.
      return {recoveryId:approved.recoveryId, delivered,
        moreMayRemain:delivered === limit, readyForTraffic:false};
    } catch (error) {
      if (open) await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = {PrivacyOfflineRecoveryExporter};
