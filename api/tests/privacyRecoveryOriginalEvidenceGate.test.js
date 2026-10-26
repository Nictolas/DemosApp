'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { REQUIRED_CONTROLS } = require('../services/privacyRecoveryQuarantineEvidenceGate');
const { canonicalSignedEvidence } = require('../services/privacyRecoverySignedEvidenceGate');
const {
  assessOriginalRecoveryArtifacts,
  PER_ARTIFACT_LIMIT_BYTES,
  TOTAL_LIMIT_BYTES
} = require('../services/privacyRecoveryOriginalEvidenceGate');

const recoveryId = 'synthetic_recovery_20261026';
const now = new Date('2026-10-26T22:00:00.000Z');
function fixture() {
  const payload = { recoveryId, controls: {} };
  const independentTrustRoots = {};
  const signerKeys = {};
  const originals = {};
  for (const type of new Set(Object.values(REQUIRED_CONTROLS))) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    signerKeys[type] = privateKey;
    independentTrustRoots[type] = {
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
      expectedSpkiSha256: crypto.createHash('sha256')
        .update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex'),
      attestorId: 'attestor_' + type
    };
  }
  for (const [control, sourceType] of Object.entries(REQUIRED_CONTROLS)) {
    const bytes = Buffer.concat([
      Buffer.from('synthetic-provider-document:' + control + ':', 'utf8'),
      Buffer.from([0, 255, 1, 128])
    ]);
    originals[control] = bytes;
    const item = {
      verified: true, scope: 'production', recoveryId, sourceType,
      observedAt: control === 'independentLedgerFreshness'
        ? '2026-10-26T21:57:00.000Z'
        : control === 'b2ImmutableVersionReadback'
          ? '2026-10-26T21:58:00.000Z'
          : control === 'controllerAndDpoApproval'
            ? '2026-10-26T21:59:00.000Z'
            : '2026-10-26T21:56:00.000Z',
      reference: 'synthetic-evidence-' + control,
      evidenceSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      attestorId: independentTrustRoots[sourceType].attestorId
    };
    item.signature = crypto.sign(null,
      canonicalSignedEvidence(recoveryId, control, item),
      signerKeys[sourceType]).toString('base64url');
    payload.controls[control] = item;
  }
  return { payload, independentTrustRoots, originals, signerKeys };
}
function assess(f) {
  return assessOriginalRecoveryArtifacts(
    f.payload, f.independentTrustRoots, f.originals, { now }
  );
}

test('signed 15/15 and byte-identical original records still require independent manual review', () => {
  const f = fixture();
  const result = assess(f);
  assert.equal(result.decision, 'MANUAL_INDEPENDENT_REVIEW_REQUIRED');
  assert.deepEqual(result.blockers, []);
  assert.equal(result.verifiedSignatures, 15);
  assert.equal(result.verifiedOriginalArtifacts, 15);
  assert.equal(result.checked, result.required);
});

test('missing artifact or missing artifact map fails even when all signatures are valid', () => {
  const f = fixture();
  assert.deepEqual(
    assessOriginalRecoveryArtifacts(f.payload, f.independentTrustRoots, null, { now }).blockers,
    ['MISSING_ORIGINAL_ARTIFACTS']
  );
  delete f.originals.supabaseDataApiProbe;
  assert.deepEqual(assess(f).blockers, ['MISSING_OR_INVALID_ORIGINAL:supabaseDataApiProbe']);
});

test('altered original bytes cannot be substituted with a precomputed self-asserted digest', () => {
  const f = fixture();
  f.originals.renderWorkersStopped = Buffer.from('tampered evidence');
  const result = assess(f);
  assert.equal(result.decision, 'NO_GO');
  assert.deepEqual(result.blockers, ['ORIGINAL_DIGEST_MISMATCH:renderWorkersStopped']);
  assert.equal(JSON.stringify(result).includes('tampered evidence'), false);
});

test('text, base64, empty records and accessor-based properties cannot masquerade as original bytes', () => {
  for (const value of ['base64-encoded', Buffer.alloc(0), { data: [1] }]) {
    const f = fixture();
    f.originals.renderIngressProbe = value;
    assert.deepEqual(assess(f).blockers, ['MISSING_OR_INVALID_ORIGINAL:renderIngressProbe']);
  }
  const f = fixture();
  Object.defineProperty(f.originals, 'renderIngressProbe', {
    enumerable: true, get() { throw Error('untrusted getter must not run'); }
  });
  assert.deepEqual(assess(f).blockers, ['MISSING_OR_INVALID_ORIGINAL:renderIngressProbe']);
});

test('unexpected controls and oversized provider records are rejected without reading user data', () => {
  const f = fixture();
  f.originals.unexpectedControl = Buffer.from('untrusted');
  assert.deepEqual(assess(f).blockers, ['UNKNOWN_ORIGINAL_ARTIFACT']);
  delete f.originals.unexpectedControl;
  f.originals.renderIngressProbe = Buffer.alloc(PER_ARTIFACT_LIMIT_BYTES + 1);
  assert.deepEqual(assess(f).blockers, ['ORIGINAL_TOO_LARGE:renderIngressProbe']);
  assert.ok(TOTAL_LIMIT_BYTES > PER_ARTIFACT_LIMIT_BYTES);
});

test('duplicate original document bytes cannot satisfy separate signed controls', () => {
  const f = fixture();
  const b = f.originals.renderIngressProbe;
  f.originals.supabaseDatabaseProbe = Buffer.from(b);
  const item = f.payload.controls.supabaseDatabaseProbe;
  item.evidenceSha256 = crypto.createHash('sha256').update(b).digest('hex');
  item.signature = crypto.sign(null,
    canonicalSignedEvidence(recoveryId, 'supabaseDatabaseProbe', item),
    f.signerKeys.independent_probe).toString('base64url');
  assert.deepEqual(assess(f).blockers, ['REUSED_ORIGINAL_ARTIFACT:supabaseDatabaseProbe']);
});

test('unsigned or unpinned claims fail before any original artifact is counted', () => {
  const f = fixture();
  f.payload.controls.supabaseDataApiDisabled.signature = 'forged';
  const result = assess(f);
  assert.equal(result.decision, 'NO_GO');
  assert.equal(result.verifiedOriginalArtifacts, 0);
  assert.ok(result.blockers.includes('UNSIGNED_OR_INVALID_ATTESTATION:supabaseDataApiDisabled'));
});

test('artifact results never include original bytes, references, signer IDs or keys', () => {
  const f = fixture();
  const result = assess(f);
  const output = JSON.stringify(result);
  assert.equal(output.includes('synthetic-provider-document'), false);
  assert.equal(output.includes('synthetic-evidence-'), false);
  assert.equal(output.includes('attestor_'), false);
  assert.equal(output.includes('publicKeyPem'), false);
});
