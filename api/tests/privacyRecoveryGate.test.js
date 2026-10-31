'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const http = require('node:http');
const crypto = require('node:crypto');
const { privacyRecoveryMaintenance } = require('../middleware/privacyRecoveryMaintenance');
const {
  signature, verifySignedManifest, reconcileRestoredPrivacyState
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
test('recovery rejects a missing maintenance attestation BEFORE connecting to DB', async () => {
  let queries = 0;
  await assert.rejects(reconcileRestoredPrivacyState({
    client: { async query() { queries++; } },
    envelope: fixture(), secret: SECRET, expectedRecoveryId: ID,
    maintenanceConfirmed: false
  }), /maintenance/);
  assert.equal(queries, 0);
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
