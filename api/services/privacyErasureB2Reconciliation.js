'use strict';

// Pure, offline reconciliation of two independently acquired inventories.
// This does NOT attest that either inventory is complete or provider-derived.
// No SQL, S3, credentials or network access; a passing result is never GO.
const crypto = require('node:crypto');
const {normalizeEvent, keyFor} = require('./privacyErasureB2Journal');

const MAX_ITEMS = 100000;
const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function bounded(items) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) fail('GDPR_B2_RECONCILIATION_INVALID_INVENTORY');
}
function digest(event) {
  return crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
}
function reconcileInventories({ledgerEvents, archivedReceipts} = {}) {
  bounded(ledgerEvents);
  bounded(archivedReceipts);
  const ledger = new Map();
  const receipts = new Map();
  for (const raw of ledgerEvents) {
    let event;
    try { event = normalizeEvent(raw); }
    catch (_) { fail('GDPR_B2_RECONCILIATION_INVALID_LEDGER_EVENT'); }
    if (ledger.has(event.event_key)) fail('GDPR_B2_RECONCILIATION_DUPLICATE_LEDGER_EVENT');
    ledger.set(event.event_key, {key:keyFor(event),sha256:digest(event)});
  }
  for (const receipt of archivedReceipts) {
    if (!receipt || typeof receipt !== 'object' ||
        typeof receipt.event_key !== 'string' || !UUID.test(receipt.event_key) ||
        typeof receipt.key !== 'string' ||
        typeof receipt.versionId !== 'string' ||
        receipt.versionId.length === 0 || receipt.versionId.length > 256 ||
        typeof receipt.sha256 !== 'string' || !SHA256.test(receipt.sha256) ||
        typeof receipt.retentionUntil !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(receipt.retentionUntil) ||
        !Number.isFinite(Date.parse(receipt.retentionUntil))) {
      fail('GDPR_B2_RECONCILIATION_INVALID_RECEIPT');
    }
    if (receipts.has(receipt.event_key)) fail('GDPR_B2_RECONCILIATION_DUPLICATE_RECEIPT');
    receipts.set(receipt.event_key,receipt);
  }
  for (const [id, expected] of ledger) {
    const actual = receipts.get(id);
    if (!actual) fail('GDPR_B2_RECONCILIATION_MISSING_RECEIPT');
    if (actual.key !== expected.key || actual.sha256 !== expected.sha256) {
      fail('GDPR_B2_RECONCILIATION_MISMATCH');
    }
  }
  for (const id of receipts.keys()) {
    if (!ledger.has(id)) fail('GDPR_B2_RECONCILIATION_ORPHAN_RECEIPT');
  }
  return Object.freeze({
    comparedEvents:ledger.size,
    matchedReceipts:receipts.size,
    // A one-to-one match is necessary but insufficient for recovery.
    complete:false, independent:false, recoveryReady:false
  });
}
module.exports = {reconcileInventories};
