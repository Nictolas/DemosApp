'use strict';

const crypto = require('node:crypto');
const Ledger = require('./privacyErasureLedgerService');

const FORMAT_VERSION = 1;
const TYPES = new Set(Object.values(Ledger.EVENT_TYPES));
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}
function normalizeEvent(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      typeof row.event_key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.event_key) ||
      typeof row.subject_user_id !== 'string' || row.subject_user_id.length < 1 ||
      row.subject_user_id.length > 128 || !TYPES.has(row.event_type)) {
    throw Error('Invalid signed privacy recovery event');
  }
  const timestamp = new Date(row.occurred_at);
  if (!Number.isFinite(timestamp.getTime())) throw Error('Invalid event timestamp');
  const details = row.details == null ? {} : row.details;
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    throw Error('Invalid privacy recovery event details');
  }
  // Store only the fields used by the ledger, in stable order, to avoid
  // accidentally signing/exporting unrelated PII from arbitrary row objects.
  const event = {
    event_key: row.event_key,
    subject_user_id: row.subject_user_id,
    event_type: row.event_type,
    occurred_at: timestamp.toISOString(),
    details: canonicalJson(details)
  };
  // A signed recovery manifest must never authorize events that the
  // immutable B2 journal cannot archive. The journal enforces the same
  // 8192-byte canonical JSON cap; reject oversized history before any SQL,
  // replay, outbox delivery or B2 readback can start.
  if (Buffer.byteLength(JSON.stringify(event), 'utf8') > 8192) {
    throw Error('Signed GDPR recovery event exceeds B2 archive limit');
  }
  return event;
}
function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object' || payload.formatVersion !== FORMAT_VERSION ||
      typeof payload.recoveryId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(payload.recoveryId) ||
      !Array.isArray(payload.events) || payload.events.length < 1 ||
      payload.events.length > 100000) {
    throw Error('Missing or invalid external privacy recovery manifest');
  }
  const captured = new Date(payload.capturedAt);
  if (!Number.isFinite(captured.getTime())) throw Error('Invalid external privacy snapshot timestamp');
  const backup = new Date(payload.restoredBackupTakenAt);
  if (!Number.isFinite(backup.getTime()) || backup > captured) {
    throw Error('Invalid signed restored-backup timestamp');
  }
  const events = payload.events.map(normalizeEvent);
  const keys = new Set();
  const consentTimestamps = new Map();
  for (const event of events) {
    if (keys.has(event.event_key)) throw Error('Repeated event in external privacy manifest');
    keys.add(event.event_key);
    if (new Date(event.occurred_at) > captured) {
      throw Error('External event occurred after manifest capture timestamp');
    }
    if (event.event_type === Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED ||
        event.event_type === Ledger.EVENT_TYPES.POLITICAL_CONSENT_GRANTED) {
      // PostgreSQL's former timestamp + random UUID tie-break could select
      // "granted" over "revoked" for two opposing events at the same instant.
      // Their real order is unknowable: do not infer consent from UUID order.
      // Compare normalized millisecond timestamps, just as the signed
      // manifest does, so sub-millisecond ambiguity is also rejected.
      const stamp = JSON.stringify([event.subject_user_id, event.occurred_at]);
      const previous = consentTimestamps.get(stamp);
      if (previous && previous !== event.event_type) {
        throw Error('Ambiguous simultaneous GDPR consent grant and revocation');
      }
      consentTimestamps.set(stamp, event.event_type);
    }
  }
  // Snapshot lists must be in stable chronological order. This is used for
  // operator review, not for the SQL state computation which uses timestamp/key.
  events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) ||
    a.event_key.localeCompare(b.event_key));
  return {
    formatVersion: FORMAT_VERSION,
    recoveryId: payload.recoveryId,
    capturedAt: captured.toISOString(),
    restoredBackupTakenAt: backup.toISOString(),
    events
  };
}
function signature(payload, secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw Error('External recovery signing secret must be at least 32 bytes');
  }
  return crypto.createHmac('sha256', secret)
    .update(JSON.stringify(normalizePayload(payload)))
    .digest('hex');
}
function verifySignedManifest(envelope, secret, expectedRecoveryId) {
  if (!envelope || typeof envelope !== 'object' ||
      typeof envelope.signature !== 'string' ||
      !/^[0-9a-f]{64}$/.test(envelope.signature)) {
    throw Error('Missing signed privacy recovery envelope');
  }
  const payload = normalizePayload(envelope.payload);
  if (!expectedRecoveryId || payload.recoveryId !== expectedRecoveryId) {
    throw Error('Recovery session does not match approved manifest');
  }
  const calculated = signature(payload, secret);
  if (!crypto.timingSafeEqual(Buffer.from(calculated, 'hex'),
    Buffer.from(envelope.signature, 'hex'))) {
    throw Error('External privacy recovery manifest signature invalid');
  }
  return payload;
}
// This SHA-256 checkpoint must come from an independent, trusted channel.
// If read from the same untrusted source as envelope, it has no anti-rollback value.
function manifestDigest(envelope) {
  if (!envelope || !/^[0-9a-f]{64}$/.test(envelope.signature || '')) {
    throw Error('Invalid manifest for checkpoint digest');
  }
  return crypto.createHash('sha256')
    .update(JSON.stringify({
      payload: normalizePayload(envelope.payload),
      signature: envelope.signature
    }))
    .digest('hex');
}

function assertIndependentRecoveryCheckpoint(envelope, {
  expectedManifestDigest, expectedRestoredBackupTakenAt, expectedCapturedAt
} = {}) {
  if (typeof expectedManifestDigest !== 'string' ||
      !/^[0-9a-f]{64}$/.test(expectedManifestDigest)) {
    throw Error('Independent manifest checkpoint is required');
  }
  const approvedBackup = new Date(expectedRestoredBackupTakenAt);
  const approvedCapture = new Date(expectedCapturedAt);
  if (!expectedRestoredBackupTakenAt || !expectedCapturedAt ||
      !Number.isFinite(approvedBackup.getTime()) ||
      !Number.isFinite(approvedCapture.getTime())) {
    throw Error('Independent backup/capture timestamps are required');
  }
  const payload = normalizePayload(envelope.payload);
  if (payload.restoredBackupTakenAt !== approvedBackup.toISOString() ||
      payload.capturedAt !== approvedCapture.toISOString()) {
    throw Error('Manifest dates mismatch independently approved recovery metadata');
  }
  const computed = Buffer.from(manifestDigest(envelope), 'hex');
  const approved = Buffer.from(expectedManifestDigest, 'hex');
  if (!crypto.timingSafeEqual(computed, approved)) {
    throw Error('Signed manifest differs from independent freshness checkpoint');
  }
}

async function reconcileRestoredPrivacyState({
  client, envelope, secret, expectedRecoveryId, maintenanceConfirmed,
  expectedManifestDigest, expectedRestoredBackupTakenAt, expectedCapturedAt
}) {
  // Important: this is an offline function, NOT a public HTTP handler.
  // An operator must ALSO isolate all provider access, all backend instances,
  // workers and Supabase Data API; HTTP middleware alone is insufficient.
  if (maintenanceConfirmed !== true) throw Error('Recovery maintenance has not been confirmed');
  const payload = verifySignedManifest(envelope, secret, expectedRecoveryId);
  assertIndependentRecoveryCheckpoint(envelope, {
    expectedManifestDigest, expectedRestoredBackupTakenAt, expectedCapturedAt
  });
  if (!client || typeof client.query !== 'function') throw Error('Database client required');
  // A malformed flag must not silently switch replay to legacy no-outbox
  // mode. Reject before BEGIN and before any restored database access.
  const outboxEnabled = Ledger.outboxEnabled();

  await client.query('BEGIN');
  try {
    // Serialize recovery sessions; use fixed, non-PII advisory lock.
    await client.query('SELECT pg_advisory_xact_lock(170026, 296)');
    // A missing ledger in the restored database is a schema/provisioning
    // failure. Never create it as a side effect of a signed replay: an
    // apparently successful import into a fresh table could mask a broken
    // or incomplete restore.
    const ledgerSchema = await client.query(
      "SELECT to_regclass('public.privacy_erasure_ledger') IS NOT NULL AS installed"
    );
    if (ledgerSchema.rows[0]?.installed !== true) {
      throw Error('GDPR recovery ledger schema missing: offline provisioning required');
    }

    // Restoring a signed event without its delivery-outbox row makes
    // subsequent B2 verification incorrectly report "no pending work".
    // Provisioning is strictly an OFFLINE operator action: no recovery DDL
    // can implicitly create a delivery table and silently accept missing
    // schema. An existing table also cannot be ignored by disabling the flag.
    const outboxSchema = await client.query(
      "SELECT to_regclass('public.privacy_erasure_delivery_outbox') IS NOT NULL AS installed"
    );
    // The mode was validated before opening the transaction.
    if (outboxSchema.rows[0]?.installed !== outboxEnabled) {
      throw Error('GDPR recovery outbox schema/mode mismatch: offline provisioning required');
    }
    if (outboxEnabled) {
      // An outbox-only row may be a trace of a missing ledger event in a
      // damaged/legacy restore. Never silently keep it while replaying the
      // approved manifest, or the later B2 readiness could miss it.
      const orphaned = await client.query(
        'SELECT EXISTS (' +
        ' SELECT 1 FROM privacy_erasure_delivery_outbox o ' +
        ' WHERE NOT EXISTS (' +
        ' SELECT 1 FROM privacy_erasure_ledger l WHERE l.event_key=o.event_key' +
        ' )) AS present'
      );
      if (orphaned.rows[0]?.present !== false) {
        throw Error('GDPR recovery outbox contains orphaned events: manual reconciliation required');
      }
    }

    // Fail closed if the restored database has ANY GDPR event missing from
    // the independently pinned manifest. A matching HMAC only authenticates
    // the supplied manifest; it does not authorize silently ignoring rows in
    // the restored ledger. The operator must reconcile histories off-line and
    // obtain a new independent approval instead of erasing unknown entries.
    const signedKeys = payload.events.map(e => e.event_key);
    const unapproved = await client.query(
      'SELECT EXISTS (' +
      ' SELECT 1 FROM privacy_erasure_ledger ' +
      ' WHERE NOT (event_key = ANY($1::text[]))' +
      ') AS present',
      [signedKeys]
    );
    if (unapproved.rows[0]?.present !== false) {
      throw Error('Restored GDPR ledger contains events absent from approved manifest');
    }

    // If the restored database contains an event with the same key but a
    // different subject/type/time, do NOT silently accept ON CONFLICT DO NOTHING.
    const existing = await client.query(
      'SELECT event_key, subject_user_id, event_type, occurred_at, details ' +
      'FROM privacy_erasure_ledger WHERE event_key = ANY($1::text[])',
      [signedKeys]
    );
    const eventsByKey = new Map(payload.events.map(e => [e.event_key, e]));
    for (const row of existing.rows) {
      const fromSigned = eventsByKey.get(row.event_key);
      if (!fromSigned || JSON.stringify(normalizeEvent(row)) !== JSON.stringify(fromSigned)) {
        throw Error('Restored ledger conflicts with signed external history');
      }
    }

    const imported = await Ledger.mergeCaptured(client, payload.events, {
      requirePreinstalled: true
    });
    const confirmed = await client.query(
      'SELECT count(*)::integer AS n FROM privacy_erasure_ledger ' +
      'WHERE event_key = ANY($1::text[])',
      [signedKeys]
    );
    if (confirmed.rows[0]?.n !== payload.events.length) {
      throw Error('Incomplete external erasure ledger import');
    }

    let outboxInserted = 0;
    let pendingExternalReceipts = null;
    if (outboxEnabled) {
      // The approved external events are imported AND queued atomically with
      // the privacy replay, without overwriting prior immutable B2 receipts.
      // Existing historical ledger entries are included as well. The
      // post-restore B2 worker/readiness verifier handles pending versions.
      const queued = await client.query(
        'INSERT INTO privacy_erasure_delivery_outbox (event_key) ' +
        'SELECT event_key FROM privacy_erasure_ledger ' +
        'ON CONFLICT (event_key) DO NOTHING'
      );
      outboxInserted = queued.rowCount || 0;
      const unqueued = await client.query(
        'SELECT COUNT(*)::int AS n FROM privacy_erasure_ledger l ' +
        'LEFT JOIN privacy_erasure_delivery_outbox o ON o.event_key=l.event_key ' +
        'WHERE o.event_key IS NULL'
      );
      if (unqueued.rows[0]?.n !== 0) {
        throw Error('GDPR recovery left ledger events without delivery-outbox rows');
      }
      const pending = await client.query(
        'SELECT COUNT(*)::int AS n FROM privacy_erasure_delivery_outbox ' +
        'WHERE delivered_at IS NULL'
      );
      pendingExternalReceipts = pending.rows[0]?.n;
      if (!Number.isInteger(pendingExternalReceipts) || pendingExternalReceipts < 0) {
        throw Error('GDPR outbox pending delivery count could not be verified');
      }
    }

    const applied = await Ledger.applyCurrentPrivacyState(client, {
      requirePreinstalled: true
    });
    // A re-grant does NOT resurrect choices from the snapshot BEFORE an older
    // revocation. Any revocation newer than the restored backup invalidates
    // that backup's personal selections even if a newer grant exists.
    // Do not override current grant flags here: new consent can remain valid.
    const staleRevocations = await client.query(
      'SELECT DISTINCT subject_user_id FROM privacy_erasure_ledger ' +
      'WHERE event_type = $1 AND occurred_at > $2::timestamptz',
      [Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED, payload.restoredBackupTakenAt]
    );
    const { cleanupConsentScopedPoliticalData } = require('./politicalConsentService');
    let staleSnapshotRevocationsReapplied = 0;
    for (const row of staleRevocations.rows) {
      await cleanupConsentScopedPoliticalData(client, row.subject_user_id);
      staleSnapshotRevocationsReapplied++;
    }
    await client.query('COMMIT');
    return {
      recoveryId: payload.recoveryId,
      capturedAt: payload.capturedAt,
      verifiedExternalEvents: payload.events.length,
      imported,
      // These counts are NOT authorization to reopen traffic. Every receipt
      // still needs external B2 readback and an independent freshness pin.
      outboxInserted,
      pendingExternalReceipts,
      staleSnapshotRevocationsReapplied,
      // Totals only; never return the subject IDs or political details.
      ...applied
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

module.exports = {
  normalizeEvent,
  normalizePayload,
  signature,
  manifestDigest,
  assertIndependentRecoveryCheckpoint,
  verifySignedManifest,
  reconcileRestoredPrivacyState
};
