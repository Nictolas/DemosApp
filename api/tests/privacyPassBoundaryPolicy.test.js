const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertNoIdentityResearchLinkage,
  buildBlindIssuanceEnvelope,
  buildResearchPresentation
} = require('../services/privacyPassBoundaryPolicy');

test('blind issuance envelope contains only blinded request and cohort context', () => {
  const envelope = buildBlindIssuanceEnvelope({
    blindedRequest: Uint8Array.from([1, 2, 3]),
    purpose: 'enroll',
    epoch: '2026-Q4'
  });
  assert.deepEqual(Object.keys(envelope).sort(), ['blindedRequest', 'epoch', 'purpose']);
});

test('Research presentation contains finalized token but no issuer-side account handle', () => {
  const presentation = buildResearchPresentation({
    token: Uint8Array.from([4, 5, 6]),
    purpose: 'enroll',
    epoch: '2026-Q4'
  });
  assert.deepEqual(Object.keys(presentation).sort(), ['epoch', 'purpose', 'token']);
});

test('boundary recursively rejects direct Identity, participant and opinion linkage', () => {
  for (const payload of [
    { account_id: 'a' },
    { nested: { userId: 'u' } },
    { email: 'person@example.test' },
    { subject: 'oidc-sub' },
    { participant_id: 'p' },
    { nested: { opinions: ['f'] } }
  ]) {
    assert.throws(() => assertNoIdentityResearchLinkage(payload), /Forbidden/);
  }
});
