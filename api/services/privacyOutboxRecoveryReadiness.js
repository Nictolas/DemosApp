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
  envelope, secret, expectedRecoveryId, expectedManifestDigest,
  expectedRestoredBackupTakenAt, expectedCapturedAt,
  maxEvents = 100000,
  pageSize = 100,
  clock = () => new Date()
} = {}) {
  if (maintenanceConfirmed !== true) {
    throw Error('Independent maintenance/quarantine attestation required');
  }
  if (!client || typeof client.query !== 'function' ||
      typeof exporter?.verifyArchivedReceipt !== 'function' ||
      typeof exporter?.config !== 'function' ||
      !Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 1000000 ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 250 ||
      typeof clock !== 'function') {
    throw Error('Invalid GDPR recovery verification configuration');
  }
  // An independently pinned manifest is required before DB or B2 access.
  const approved = verifySignedManifest(envelope, secret, expectedRecoveryId);
  assertIndependentRecoveryCheckpoint(envelope, {
    expectedManifestDigest, expectedRestoredBackupTakenAt, expectedCapturedAt
  });
  if (approved.events.length > maxEvents) {
    throw Error('Approved GDPR manifest exceeds verification safety cap');
  }
  const unseen = new Map(approved.events.map(event => [event.event_key, event]));
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
    // The forward ledger->outbox check alone misses outbox-only events.
    // An incomplete/corrupt restore could drop a ledger event but leave a
    // delivered receipt in a legacy outbox without its expected foreign key.
    // Do not declare readiness when ANY delivery record lacks a ledger row.
    const orphaned = await client.query(
      'SELECT EXISTS (' +
      ' SELECT 1 FROM privacy_erasure_delivery_outbox o ' +
      ' WHERE NOT EXISTS (' +
      ' SELECT 1 FROM privacy_erasure_ledger l WHERE l.event_key=o.event_key' +
      ' )) AS present'
    );
    if (orphaned.rows[0]?.present !== false) {
      throw Error('GDPR delivery outbox contains orphaned events: recovery refused');
    }
    let cursor = '';
    let verified = 0;
    let earliestRetentionUntil = null;
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
        const expected = unseen.get(row.event_key);
        if (!expected) {
          throw Error('GDPR ledger contains event absent from approved external manifest');
        }
        if (JSON.stringify(normalizeEvent(row)) !== JSON.stringify(expected)) {
          throw Error('GDPR ledger event conflicts with approved external manifest');
        }
        if (!row.delivered_at || !row.b2_version_id ||
            !/^[0-9a-f]{64}$/.test(row.b2_sha256 || '')) {
          throw Error('GDPR event has no verified external delivery receipt');
        }
        const receipt = {
          versionId: row.b2_version_id, sha256: row.b2_sha256
        };
        // No B2 writes. Read back the exact recorded immutable object version.
        const checked = await exporter.verifyArchivedReceipt(row, receipt);
        // Do not rely only on the exporter claiming success. A substituted,
        // stale or incomplete verifier could return a plausible retention
        // timestamp while referring to another B2 version or event hash.
        // Match BOTH immutable receipt identifiers again at this gate.
        if (checked?.versionId !== receipt.versionId ||
            checked?.sha256 !== receipt.sha256) {
          throw Error('B2 receipt verifier returned mismatched version or SHA256');
        }
        // Individual readbacks are not enough: a version verified at the
        // beginning of a long scan may expire before the LAST event is read.
        // Require an explicit expiry from the independently checked B2 lock.
        const expiry = checked?.retentionUntil;
        const until = typeof expiry === 'string' ? new Date(expiry) : null;
        if (!until || !Number.isFinite(until.getTime()) ||
            until.toISOString() !== expiry) {
          throw Error('B2 receipt verifier omitted a valid retention expiry');
        }
        if (!earliestRetentionUntil || until < earliestRetentionUntil) {
          earliestRetentionUntil = until;
        }
        unseen.delete(row.event_key);
        verified++;
        cursor = row.event_key;
      }
    }
    if (unseen.size !== 0) {
      throw Error('Approved external GDPR manifest has events missing from restored ledger');
    }
    const finishedAt = clock();
    if (!(finishedAt instanceof Date) || !Number.isFinite(finishedAt.getTime())) {
      throw Error('Invalid GDPR recovery verification clock');
    }
    if (!earliestRetentionUntil || earliestRetentionUntil <= finishedAt) {
      throw Error('B2 event Object Lock expired during full recovery verification');
    }
    await client.query('COMMIT');
    open = false;
    return { ready: true, verifiedEvents: verified, pinnedEvents: approved.events.length };
  } catch (error) {
    if (open) await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

module.exports = { verifyOutboxRecoveryReadiness };
