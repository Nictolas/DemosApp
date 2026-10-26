'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const http = require('node:http');
const crypto = require('node:crypto');
const { privacyRecoveryMaintenance } = require('../middleware/privacyRecoveryMaintenance');
const { verifyOutboxRecoveryReadiness } = require('../services/privacyOutboxRecoveryReadiness');
const { normalizeEvent: normalizeB2Event } = require('../services/privacyErasureB2Journal');
const {
  signature, manifestDigest, assertIndependentRecoveryCheckpoint, verifySignedManifest, reconcileRestoredPrivacyState
} = require('../services/privacyRecoveryGateService');

const SECRET = 'synthetic-test-only-hmac-key-at-least-32-bytes';
const KEY = '00000000-0000-4000-8000-000000000301';
const ID = 'recovery_ci_20261026';
const mkEvent = (type = 'political_consent_revoked', extras = {}) => ({
  event_key: crypto.randomUUID(), subject_user_id: KEY, event_type: type,
  occurred_at: '2026-10-26T00:00:00.000Z', details: { action: 'test', z: 1 },
  ...extras
});
function signed(payload) { return { payload, signature: signature(payload, SECRET) }; }
function fixture(events = [mkEvent()]) {
  return signed({
    formatVersion: 1, recoveryId: ID, capturedAt: '2026-10-26T01:00:00.000Z',
    restoredBackupTakenAt: '2026-10-24T00:00:00.000Z',
    events
  });
}
test('HMAC is stable regardless of object key order and PostgreSQL JSONB property order', () => {
  const event = mkEvent();
  const reordered = { ...event, details: { z: 1, action: 'test' } };
  assert.equal(signature(fixture([event]).payload, SECRET),
    signature(fixture([reordered]).payload, SECRET));
});
test('signed recovery snapshot verifies only for exact approved session', () => {
  const envelope = fixture();
  const value = verifySignedManifest(envelope, SECRET, ID);
  assert.equal(value.events.length, 1);
  assert.throws(() => verifySignedManifest(envelope, SECRET, 'wrong_recovery_20261026'),
    /Recovery session/);
  assert.throws(() => verifySignedManifest(envelope, 'wrong-signing-secret-32-characters-long', ID),
    /signature invalid/);
});
test('unsigned, truncated, tampered and duplicate recovery evidence fail closed', () => {
  const original = fixture();
  assert.throws(() => verifySignedManifest({ payload: original.payload }, SECRET, ID), /Missing signed/);
  assert.throws(() => verifySignedManifest({ ...original, signature: 'a'.repeat(32) }, SECRET, ID), /Missing signed/);
  const changed = structuredClone(original);
  changed.payload.events[0].subject_user_id = 'other-person';
  assert.throws(() => verifySignedManifest(changed, SECRET, ID), /signature invalid/);
});
test('duplicate events, events after capture and malformed timestamps fail during signing', () => {
  const event = mkEvent();
  assert.throws(() => fixture([event, { ...event }]), /Repeated event/);
  assert.throws(() => fixture([mkEvent('political_consent_revoked', {
    occurred_at: '2026-10-27T00:00:00Z'
  })]), /after manifest/);
  assert.throws(() => fixture([mkEvent('political_consent_revoked', { occurred_at: 'bad' })]),
    /Invalid event timestamp/);
});
test('signed recovery refuses events that cannot fit the immutable B2 archive before any I/O', async () => {
  // B2 archiveEvent normalizes canonical JSON and refuses >8192 bytes.
  // Without matching validation here, a valid signed recovery could commit
  // an oversized event that the B2 worker can never deliver.
  const within = mkEvent('political_consent_revoked', {
    details: {synthetic: 'x'.repeat(7900)}
  });
  assert.doesNotThrow(() => fixture([within]));
  assert.doesNotThrow(() => normalizeB2Event(within));
  const oversized = mkEvent('political_consent_revoked', {
    details: {synthetic: 'x'.repeat(9000)}
  });
  assert.throws(() => fixture([oversized]), /B2 archive limit/);
  assert.throws(() => normalizeB2Event(oversized), /minimization limit/);

  // An attacker-supplied signed-looking manifest must be rejected during
  // normalization, without connecting to PostgreSQL or contacting B2.
  const payload = {
    formatVersion:1,recoveryId:ID,
    capturedAt:'2026-10-26T01:00:00.000Z',
    restoredBackupTakenAt:'2026-10-24T00:00:00.000Z',
    events:[oversized]
  };
  const envelope = {payload,signature:'a'.repeat(64)};
  let sql = 0, network = 0;
  const client = {async query(){sql++;throw Error('unexpected SQL');}};
  const exporter = {
    config(){network++;throw Error('unexpected B2');},
    async verifyArchivedReceipt(){network++;throw Error('unexpected B2');}
  };
  await assert.rejects(reconcileRestoredPrivacyState({
    client,envelope,secret:SECRET,expectedRecoveryId:ID,
    maintenanceConfirmed:true
  }),/B2 archive limit/);
  await assert.rejects(verifyOutboxRecoveryReadiness(client,{
    maintenanceConfirmed:true,exporter,envelope,secret:SECRET,
    expectedRecoveryId:ID
  }),/B2 archive limit/);
  assert.equal(sql,0);
  assert.equal(network,0);
});

test('opposing consent events at the same millisecond cannot be signed or replayed', async () => {
  const sameInstant = '2026-10-26T00:00:00.000Z';
  const revoke = mkEvent('political_consent_revoked', {occurred_at:sameInstant});
  const grant = mkEvent('political_consent_granted', {
    occurred_at:'2026-10-26T00:00:00.000500Z'
  });
  assert.throws(() => fixture([revoke, grant]), /Ambiguous simultaneous GDPR consent/);
  // No DB query may be attempted even if a caller supplies a signed-looking
  // envelope. The collision is rejected during payload normalization.
  const payload = {
    formatVersion:1, recoveryId:ID, capturedAt:'2026-10-26T01:00:00.000Z',
    restoredBackupTakenAt:'2026-10-24T00:00:00.000Z',
    events:[revoke,grant]
  };
  let queries = 0;
  await assert.rejects(reconcileRestoredPrivacyState({
    client:{async query(){queries++;}},
    envelope:{payload,signature:'a'.repeat(64)},
    secret:SECRET,expectedRecoveryId:ID,maintenanceConfirmed:true
  }), /Ambiguous simultaneous GDPR consent/);
  assert.equal(queries,0);
});

test('pinned external SHA256 refuses signed stale manifests without any DB access', async () => {
  const approved = fixture();
  const stale = fixture([mkEvent('political_consent_revoked',{
    occurred_at:'2026-10-25T00:00:00.000Z'
  })]);
  const checkpoint = {
    expectedManifestDigest: manifestDigest(approved),
    expectedRestoredBackupTakenAt: approved.payload.restoredBackupTakenAt,
    expectedCapturedAt: approved.payload.capturedAt
  };
  assert.doesNotThrow(()=>assertIndependentRecoveryCheckpoint(approved,checkpoint));
  assert.throws(()=>assertIndependentRecoveryCheckpoint(stale,checkpoint),/freshness checkpoint/);
  assert.throws(()=>assertIndependentRecoveryCheckpoint(approved,{
    ...checkpoint,expectedRestoredBackupTakenAt:'2026-10-23T00:00:00Z'
  }),/dates mismatch/);
  let queries=0;
  const client={async query(){queries++;}};
  await assert.rejects(reconcileRestoredPrivacyState({
    client,envelope:stale,secret:SECRET,expectedRecoveryId:ID,
    maintenanceConfirmed:true,...checkpoint
  }),/freshness checkpoint/);
  await assert.rejects(reconcileRestoredPrivacyState({
    client,envelope:approved,secret:SECRET,expectedRecoveryId:ID,
    maintenanceConfirmed:true
  }),/checkpoint is required/);
  assert.equal(queries,0);
});
test('recovery rejects a missing maintenance attestation BEFORE connecting to DB', async () => {
  let queries = 0;
  await assert.rejects(reconcileRestoredPrivacyState({
    client: { async query() { queries++; } },
    envelope: fixture(), secret: SECRET, expectedRecoveryId: ID,
    maintenanceConfirmed: false
  }), /maintenance/);
  assert.equal(queries, 0);
});
test('B2 readiness requires independently approved signed history before any DB or network access', async () => {
  let sql = 0, remote = 0;
  const client = { async query() { sql++; throw Error('unexpected-sql'); } };
  const exporter = {
    config() { remote++; throw Error('unexpected-remote'); },
    async verifyArchivedReceipt() { remote++; throw Error('unexpected-remote'); }
  };
  await assert.rejects(verifyOutboxRecoveryReadiness(client,{
    maintenanceConfirmed:true,exporter
  }),/Missing signed/);
  const envelope = fixture();
  await assert.rejects(verifyOutboxRecoveryReadiness(client,{
    maintenanceConfirmed:true,exporter,envelope,secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:'f'.repeat(64),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt
  }),/freshness checkpoint/);
  assert.equal(sql,0);
  assert.equal(remote,0);
});

test('B2 readiness refuses orphaned delivery rows before any remote object read', async () => {
  const envelope = fixture();
  const sql = [];
  let remoteReads = 0;
  const client = { async query(statement) {
    sql.push(statement);
    if (statement.startsWith('BEGIN TRANSACTION')) return {rows:[]};
    if (statement.includes("to_regclass('public.privacy_erasure_ledger')")) {
      return {rows:[{ledger:true,outbox:true}]};
    }
    if (statement.includes('FROM privacy_erasure_delivery_outbox o')) {
      return {rows:[{present:true}]};
    }
    if (statement === 'ROLLBACK') return {rows:[]};
    throw Error('Unexpected SQL after orphan detection');
  }};
  const exporter = {
    config() { return {}; },
    async verifyArchivedReceipt() { remoteReads++; throw Error('Unexpected B2 GET'); }
  };
  await assert.rejects(verifyOutboxRecoveryReadiness(client, {
    maintenanceConfirmed:true,exporter,envelope,secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:manifestDigest(envelope),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt
  }), /orphaned events/);
  assert.equal(remoteReads,0);
  assert.ok(sql.includes('ROLLBACK'));
  assert.equal(sql.some(statement => statement.includes('ORDER BY l.event_key')),false);
});

test('recovery HTTP middleware refuses health, GET, write and OPTIONS with no-store', async () => {
  const previous = process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE;
  const app = express();
  app.use(privacyRecoveryMaintenance);
  app.all('/api/health', (_req, res) => res.status(200).end());
  app.all('/api/opinioni/salva', (_req, res) => res.status(200).end());
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = 'true';
    for (const [route, method] of [['/api/health', 'GET'], ['/api/opinioni/salva', 'POST'],
      ['/api/opinioni/salva', 'OPTIONS']]) {
      const response = await fetch('http://127.0.0.1:' + port + route, { method });
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
      assert.equal((await response.json()).code, 'GDPR_RECOVERY_MAINTENANCE');
    }
    process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = 'false';
    assert.equal((await fetch('http://127.0.0.1:' + port + '/api/health')).status, 200);
  } finally {
    if (previous === undefined) delete process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE;
    else process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = previous;
    await new Promise(resolve => server.close(resolve));
  }
});
test('main app mounts recovery gate before CORS OPTIONS, logging and routes', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const i = src.indexOf('app.use(privacyRecoveryMaintenance)');
  assert.ok(i > src.indexOf('const app = express()'));
  assert.ok(i < src.indexOf('app.options('));
  assert.ok(i < src.indexOf("app.use('/api', healthRoutes)"));
});
