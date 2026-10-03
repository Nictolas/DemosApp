const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  toResearchIssuerKeySetHealth
} = require('../services/researchIssuerKeySetHealth');

test('issuer key-set health exposes only coarse readiness state', () => {
  assert.deepEqual(
    toResearchIssuerKeySetHealth({ ready: true, sequence: 42, expiresAt: 123456 }),
    { ready: true }
  );
  assert.deepEqual(
    toResearchIssuerKeySetHealth({
      ready: false,
      reason: 'freshness-window',
      sequence: 42,
      expiresAt: 123456,
      tokenKeyId: 'must-not-leak'
    }),
    { ready: false, reason: 'freshness-window' }
  );
  assert.deepEqual(
    toResearchIssuerKeySetHealth({ ready: false, reason: 'missing' }),
    { ready: false, reason: 'missing' }
  );
  assert.deepEqual(
    toResearchIssuerKeySetHealth({ ready: false, reason: 'expired' }),
    { ready: false, reason: 'expired' }
  );
});

test('issuer key-set health reports recovery failure without snapshot details', () => {
  assert.deepEqual(
    toResearchIssuerKeySetHealth(
      { ready: true, sequence: 99, expiresAt: 999999, snapshotJson: 'secret' },
      { recoveryFailed: true }
    ),
    { ready: false, reason: 'recovery-failed' }
  );
  assert.deepEqual(
    toResearchIssuerKeySetHealth({ ready: false, reason: 'unexpected-internal-reason' }),
    { ready: false, reason: 'unavailable' }
  );
  assert.deepEqual(
    toResearchIssuerKeySetHealth(null),
    { ready: false, reason: 'unavailable' }
  );
});

test('issuer key-set health helper has no Identity, network, snapshot or key material dependency', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchIssuerKeySetHealth.js'),
    'utf8'
  );
  assert.doesNotMatch(
    source,
    /identityAuth|sessionService|DATABASE_URL|RESEARCH_DATABASE_URL|axios|fetch\s*\(|https?:\/\/|tokenKeyId|publicKey|snapshotJson/
  );
});
