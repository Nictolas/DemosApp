const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  canResearchUseIssuerKeySet,
  classifyResearchIssuerKeySetHealth
} = require('../services/researchIssuerKeySetHealthPolicy');

test('issuer key-set health policy permits only exact ready health', () => {
  assert.equal(canResearchUseIssuerKeySet({ ready: true }), true);
  assert.equal(canResearchUseIssuerKeySet({ ready: true, sequence: 12 }), false);
  assert.equal(canResearchUseIssuerKeySet({ ready: false, reason: 'expired' }), false);
  assert.equal(canResearchUseIssuerKeySet(null), false);
});

test('issuer key-set health policy preserves only allowlisted coarse failure reasons', () => {
  assert.deepEqual(
    classifyResearchIssuerKeySetHealth({ ready: false, reason: 'recovery-failed' }),
    { usable: false, reason: 'recovery-failed' }
  );
  assert.deepEqual(
    classifyResearchIssuerKeySetHealth({ ready: false, reason: 'secret-internal-state' }),
    { usable: false, reason: 'unavailable' }
  );
  assert.deepEqual(
    classifyResearchIssuerKeySetHealth({ ready: true }),
    { usable: true }
  );
});

test('issuer key-set health policy stays pure and detached from Identity, network and production wiring', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchIssuerKeySetHealthPolicy.js'),
    'utf8'
  );
  assert.doesNotMatch(
    source,
    /identityAuth|sessionService|DATABASE_URL|RESEARCH_DATABASE_URL|axios|fetch\s*\(|https?:\/\/|express|router|console\./
  );
});
