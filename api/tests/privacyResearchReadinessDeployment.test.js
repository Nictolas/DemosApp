const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { loadResearchReadinessDeployment, MAX_MANIFEST_BYTES } = require('../config/researchReadinessDeployment');

test('Research readiness deployment loader is fail-closed for missing, malformed and oversized input', () => {
  assert.deepEqual(loadResearchReadinessDeployment({}), { configured: false });
  assert.deepEqual(loadResearchReadinessDeployment({
    RESEARCH_READINESS_MANIFEST: '{bad',
    RESEARCH_READINESS_SIGNATURE: 'abc',
    RESEARCH_READINESS_PUBLIC_KEY: 'bad'
  }), { configured: false });
  assert.deepEqual(loadResearchReadinessDeployment({
    RESEARCH_READINESS_MANIFEST: 'x'.repeat(MAX_MANIFEST_BYTES + 1),
    RESEARCH_READINESS_SIGNATURE: 'abc',
    RESEARCH_READINESS_PUBLIC_KEY: 'x'
  }), { configured: false });
});

test('Research readiness deployment loader accepts only an Ed25519 public key', () => {
  const ed = crypto.generateKeyPairSync('ed25519');
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const base = {
    RESEARCH_READINESS_MANIFEST: JSON.stringify({ version: 1 }),
    RESEARCH_READINESS_SIGNATURE: 'abc'
  };
  assert.equal(loadResearchReadinessDeployment({
    ...base,
    RESEARCH_READINESS_PUBLIC_KEY: rsa.publicKey.export({ type: 'spki', format: 'pem' })
  }).configured, false);
  assert.equal(loadResearchReadinessDeployment({
    ...base,
    RESEARCH_READINESS_PUBLIC_KEY: ed.publicKey.export({ type: 'spki', format: 'pem' })
  }).configured, true);
});
