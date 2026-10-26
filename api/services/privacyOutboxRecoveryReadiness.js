'use strict';

const { PrivacyErasureB2Journal } = require('./privacyErasureB2Journal');
const { normalizeEvent, verifySignedManifest, assertIndependentRecoveryCheckpoint } = require('./privacyRecoveryGateService');

/**
 * Read-only offline acceptance check for a QUARANTINED source DB.
 * A clean result proves only that this PostgreSQL snapshot has matching
 * immutable B2 versions; it CANNOT prove that an event committed after
 * this snapshot was not lost when the database failed.
 */
async function verifyOutboxRecoveryReadiness(client, {
  maintenanceConfirmed = false,
  exporter = new PrivacyErasureB2Journal(),
  maxEvents = 100000,
  pageSize = 100
} = {}) {
  if (maintenanceConfirmed !== true) {
    throw Error('Independent maintenance/quarantine attestation required');
  }
  if (!client || typeof client.query !== 'function' ||
      typeof exporter?.verifyArchivedReceipt !== 'function' ||
      typeof exporter?.config !== 'function' ||
      !Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 1000000 ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 250) {
    throw Error('Invalid GDPR recovery verification configuration');
  }
  // Refuse before SQL when B2 is not explicitly configured/available.
  exporter.config();
  let open = false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    open = true;
    const presence = await client.query(
      "SELECT to_regclass('public.privacy_erasure_ledger') IS NOT NULL AS ledger, " +
      "to_regclass('public.privacy_erasure_delivery_outbox') IS NOT NULL AS outbox"
    );
    if (!presence.rows[0]?.ledger || !presence.rows[0]?.outbox) {
      throw Error('Incomplete GDPR ledger/outbox schema: recovery refused');
    }
    let cursor = '';
    let verified = 0;
    for (;;) {
      const result = await client.query(
        'SELECT l.event_key, l.subject_user_id, l.event_type, ' +
        'l.occurred_at, l.details, o.delivered_at, ' +
        'o.b2_version_id, o.b2_sha256 ' +
        'FROM privacy_erasure_ledger l ' +
        'LEFT JOIN privacy_erasure_delivery_outbox o ON o.event_key=l.event_key ' +
        'WHERE l.event_key > $1 ORDER BY l.event_key ASC LIMIT $2',
        [cursor, pageSize]
      );
      if (result.rows.length === 0) break;
      if (verified + result.rows.length > maxEvents) {
        throw Error('GDPR verification safety cap reached: recovery refused');
      }
      for (const row of result.rows) {
        if (!row.delivered_at || !row.b2_version_id ||
            !/^[0-9a-f]{64}$/.test(row.b2_sha256 || '')) {
          throw Error('GDPR event has no verified external delivery receipt');
        }
        const receipt = {
          versionId: row.b2_version_id, sha256: row.b2_sha256
        };
        // No B2 writes. Read back the exact recorded immutable object version.
        await exporter.verifyArchivedReceipt(row, receipt);
        verified++;
        cursor = row.event_key;
      }
    }
    await client.query('COMMIT');
    open = false;
    return { ready: true, verifiedEvents: verified };
  } catch (error) {
    if (open) await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

module.exports = { verifyOutboxRecoveryReadiness };
