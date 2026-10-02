const test = require('node:test');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { REQUIRED_RESEARCH_PRODUCTION_DECISIONS } = require('../config/researchProductionReadinessPolicy');
const { mountResearchPublicApiIfProductionReady } = require('../researchProductionMountGate');
const { REQUIRED_EVIDENCE_KEYS, canonicalizeReadinessManifest } = require('../config/researchReadinessManifest');

const allReady = () => Object.fromEntries(
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
);
const manifestEvidence = Object.fromEntries(REQUIRED_EVIDENCE_KEYS.map((key) => [key, true]));
const readinessManifest = {
  version: 1,
  issuedAt: '2026-10-02T18:00:00.000Z',
  expiresAt: '2026-10-03T18:00:00.000Z',
  evidence: manifestEvidence
};
const signedManifestOptions = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    readinessManifest,
    readinessManifestSignature: crypto.sign(
      null,
      Buffer.from(canonicalizeReadinessManifest(readinessManifest)),
      privateKey
    ).toString('base64url'),
    readinessManifestPublicKey: publicKey,
    now: new Date('2026-10-02T19:00:00.000Z')
  };
};

test('Research production mount gate blocks without service blueprint evidence', () => {
  let mountCalls = 0;
  const options = signedManifestOptions();
  const incomplete = {
    ...readinessManifest,
    evidence: { ...manifestEvidence, researchServiceBlueprint: false }
  };
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const result = mountResearchPublicApiIfProductionReady({ use() {} }, {
    decisions: allReady(),
    readinessManifest: incomplete,
    readinessManifestSignature: crypto.sign(null, Buffer.from(canonicalizeReadinessManifest(incomplete)), privateKey).toString('base64url'),
    readinessManifestPublicKey: publicKey,
    now: options.now,
    mount() { mountCalls += 1; return { mounted: true }; }
  });
  assert.equal(result.mounted, false);
  assert.equal(result.blockers.includes('serviceBlueprintConfigured'), true);
  assert.equal(mountCalls, 0);
});

test('Research production mount gate delegates only after all readiness checks pass', () => {
  const app = { use() {} };
  let mountCalls = 0;
  const result = mountResearchPublicApiIfProductionReady(app, {
    decisions: allReady(),
    ...signedManifestOptions(),
    mount(receivedApp) {
      mountCalls += 1;
      assert.equal(receivedApp, app);
      return { mounted: true };
    }
  });
  assert.equal(result.mounted, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(mountCalls, 1);
});


test('Research production gate stays fail-closed with no decisions or evidence', () => {
  let mountCalls = 0;
  const result = mountResearchPublicApiIfProductionReady({ use() {} }, {
    decisions: {},
    mount() { mountCalls += 1; return { mounted: true }; }
  });
  assert.equal(result.mounted, false);
  assert.equal(result.blockers.includes('productionApprovalRecorded'), true);
  assert.equal(result.blockers.includes('researchDatabaseConfigured'), true);
  assert.equal(result.blockers.includes('researchSchemaValidated'), true);
  assert.equal(result.blockers.includes('researchSastCleared'), true);
  assert.equal(result.blockers.includes('serviceBlueprintConfigured'), true);
  assert.equal(mountCalls, 0);
});


test('Research production gate rejects unsigned direct evidence booleans', () => {
  let mountCalls = 0;
  const directEvidence = Object.fromEntries(REQUIRED_EVIDENCE_KEYS.map((key) => [key, { approved: true }]));
  const result = mountResearchPublicApiIfProductionReady({ use() {} }, {
    decisions: allReady(),
    ...directEvidence,
    mount() { mountCalls += 1; return { mounted: true }; }
  });
  assert.equal(result.mounted, false);
  assert.equal(mountCalls, 0);
});
