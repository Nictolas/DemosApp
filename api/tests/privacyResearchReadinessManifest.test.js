const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  REQUIRED_EVIDENCE_KEYS,
  canonicalizeReadinessManifest,
  verifyResearchReadinessManifest
} = require('../config/researchReadinessManifest');

const evidence = Object.fromEntries(REQUIRED_EVIDENCE_KEYS.map((key) => [key, true]));
const manifest = {
  version: 1,
  issuedAt: '2026-10-02T18:00:00.000Z',
  expiresAt: '2026-10-03T18:00:00.000Z',
  commitSha: '0123456789abcdef0123456789abcdef01234567',
  evidence
};
const sign = (privateKey, value = manifest) =>
  crypto.sign(null, Buffer.from(canonicalizeReadinessManifest(value)), privateKey).toString('base64url');

test('Research readiness manifest verifies only with valid Ed25519 signature and complete evidence', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const result = verifyResearchReadinessManifest({
    manifest,
    signature: sign(privateKey),
    publicKey,
    now: new Date('2026-10-02T19:00:00.000Z'), expectedCommitSha: manifest.commitSha
  });
  assert.equal(result.valid, true);
  REQUIRED_EVIDENCE_KEYS.forEach((key) => assert.equal(result.evidence[key].approved, true));
});

test('Research readiness manifest rejects tampering, expiry and incomplete evidence', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const signature = sign(privateKey);
  assert.equal(verifyResearchReadinessManifest({
    manifest: { ...manifest, expiresAt: '2026-10-04T18:00:00.000Z' },
    signature, publicKey, now: new Date('2026-10-02T19:00:00.000Z'), expectedCommitSha: manifest.commitSha
  }).valid, false);
  assert.equal(verifyResearchReadinessManifest({
    manifest, signature, publicKey, now: new Date('2026-10-04T19:00:00.000Z'), expectedCommitSha: manifest.commitSha
  }).valid, false);
  const incomplete = { ...manifest, evidence: { ...evidence, telemetrySink: false } };
  assert.equal(verifyResearchReadinessManifest({
    manifest: incomplete, signature: sign(privateKey, incomplete), publicKey,
    now: new Date('2026-10-02T19:00:00.000Z'), expectedCommitSha: manifest.commitSha
  }).valid, false);
});

test('Research readiness manifest is fail-closed without signature or public key', () => {
  assert.equal(verifyResearchReadinessManifest({ manifest }).valid, false);
});


test('Research readiness manifest rejects unknown or missing evidence keys', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const extra={...manifest,evidence:{...evidence,unexpected:true}};
  assert.throws(()=>canonicalizeReadinessManifest(extra),/evidence keys/);
  const missing={...manifest,evidence:Object.fromEntries(Object.entries(evidence).slice(1))};
  assert.throws(()=>canonicalizeReadinessManifest(missing),/evidence keys/);
});

test('Research readiness manifest is bound to the expected build commit', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  assert.equal(verifyResearchReadinessManifest({manifest,signature:sign(privateKey),publicKey,now:new Date('2026-10-02T19:00:00.000Z'),expectedCommitSha:'ffffffffffffffffffffffffffffffffffffffff'}).valid,false);
});

test('Research readiness manifest verifier rejects non-Ed25519 keys', () => {
  const { publicKey } = crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  assert.equal(verifyResearchReadinessManifest({manifest,signature:'AA',publicKey,now:new Date('2026-10-02T19:00:00.000Z'),expectedCommitSha:manifest.commitSha}).valid,false);
});
