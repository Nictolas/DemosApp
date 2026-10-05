const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  REQUIRED_RESEARCH_CLIENT_ADDRESS_TRUST_DECISIONS
} = require('../config/researchClientAddressTrustPolicy');
const {
  createResearchEvidenceGatedClientKeyGenerator
} = require('../services/researchClientAddressKeyComposition');

const allApproved = () => Object.fromEntries(
  REQUIRED_RESEARCH_CLIENT_ADDRESS_TRUST_DECISIONS.map((key) => [key, true])
);

const request = ({ remoteAddress, forwardedFor } = {}) => ({
  socket: { remoteAddress },
  headers: { 'x-forwarded-for': forwardedFor }
});

test('Research client-key composition refuses to exist before deployment trust evidence is complete', () => {
  const decisions = allApproved();
  decisions.forwardedForSanitizationVerified = false;

  assert.throws(
    () => createResearchEvidenceGatedClientKeyGenerator({
      trustDecisions: decisions,
      trustedProxyHops: 1,
      isTrustedProxyAddress: () => true
    }),
    /forwardedForSanitizationVerified/
  );
});

test('Research client-key composition binds approved evidence to an explicit proxy topology', () => {
  const generator = createResearchEvidenceGatedClientKeyGenerator({
    trustDecisions: allApproved(),
    trustedProxyHops: 2,
    isTrustedProxyAddress: (address) => ['10.0.0.1', '10.0.0.2'].includes(address)
  });

  assert.equal(
    generator(request({
      remoteAddress: '10.0.0.2',
      forwardedFor: '192.0.2.99, 198.51.100.8, 10.0.0.1'
    })),
    '198.51.100.8'
  );
});

test('Research evidence-gated client key still fails closed when runtime topology disagrees', () => {
  const generator = createResearchEvidenceGatedClientKeyGenerator({
    trustDecisions: allApproved(),
    trustedProxyHops: 1,
    isTrustedProxyAddress: (address) => address === '10.0.0.2'
  });

  assert.throws(
    () => generator(request({
      remoteAddress: '203.0.113.10',
      forwardedFor: '198.51.100.8'
    })),
    /direct peer is not a trusted proxy/
  );
});

test('Research evidence-gated client key remains shadow-only and is not wired into the public mount', () => {
  const files = ['research-app.js', 'researchPublicApiMount.js', 'routes/researchPublicRouter.js'];
  const source = files.map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /researchClientAddressKeyComposition|createResearchEvidenceGatedClientKeyGenerator/);
});
