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
      typeof row.event_key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.event_key) ||
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
  return {
    event_key: row.event_key,
    subject_user_id: row.subject_user_id,
    event_type: row.event_type,
    occurred_at: timestamp.toISOString(),
    details: canonicalJson(details)
  };
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
  for (const event of events) {
    if (keys.has(event.event_key)) throw Error('Repeated event in external privacy manifest');
    keys.add(event.event_key);
    if (new Date(event.occurred_at) > captured) {
      throw Error('External event occurred after manifest capture timestamp');
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
async function reconcileRestoredPrivacyState({
  client, envelope, secret, expectedRecoveryId, maintenanceConfirmed
}) {
  // Important: this is an offline function, NOT a public HTTP handler.
  // An operator must ALSO isolate all provider access, all backend instances,
  // workers and Supabase Data API; HTTP middleware alone is insufficient.
  if (maintenanceConfirmed !== true) throw Error('Recovery maintenance has not been confirmed');
  const payload = verifySignedManifest(envelope, secret, expectedRecoveryId);
  if (!client || typeof client.query !== 'function') throw Error('Database client required');

  await client.query('BEGIN');
  try {
    // Serialize recovery sessions; use fixed, non-PII advisory lock.
    await client.query('SELECT pg_advisory_xact_lock(170026, 296)');
    await Ledger.ensureTable(client);

    // If the restored database contains an event with the same key but a
    // different subject/type/time, do NOT silently accept ON CONFLICT DO NOTHING.
    const existing = await client.query(
      'SELECT event_key, subject_user_id, event_type, occurred_at, details ' +
      'FROM privacy_erasure_ledger WHERE event_key = ANY($1::text[])',
      [payload.events.map(e => e.event_key)]
    );
    const eventsByKey = new Map(payload.events.map(e => [e.event_key, e]));
    for (const row of existing.rows) {
      const fromSigned = eventsByKey.get(row.event_key);
      if (!fromSigned || JSON.stringify(normalizeEvent(row)) !== JSON.stringify(fromSigned)) {
        throw Error('Restored ledger conflicts with signed external history');
      }
    }

    const imported = await Ledger.mergeCaptured(client, payload.events);
    const confirmed = await client.query(
      'SELECT count(*)::integer AS n FROM privacy_erasure_ledger ' +
      'WHERE event_key = ANY($1::text[])',
      [payload.events.map(e => e.event_key)]
    );
    if (confirmed.rows[0]?.n !== payload.events.length) {
      throw Error('Incomplete external erasure ledger import');
    }
    const applied = await Ledger.applyCurrentPrivacyState(client);
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
  normalizePayload,
  signature,
  verifySignedManifest,
  reconcileRestoredPrivacyState
};
