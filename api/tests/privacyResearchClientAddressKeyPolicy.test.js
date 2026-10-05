const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MAX_RESEARCH_FORWARDED_CHAIN_LENGTH,
  MAX_RESEARCH_TRUSTED_PROXY_HOPS,
  normalizeIpLiteral,
  parseForwardedFor,
  createResearchClientAddressKeyGenerator
} = require('../services/researchClientAddressKeyPolicy');

const request = ({ remoteAddress, forwardedFor } = {}) => ({
  socket: { remoteAddress },
  headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor }
});

test('Research client-address policy normalizes IP literals without accepting host:port input', () => {
  assert.equal(normalizeIpLiteral('198.51.100.7'), '198.51.100.7');
  assert.equal(normalizeIpLiteral('::ffff:198.51.100.7'), '198.51.100.7');
  assert.equal(normalizeIpLiteral('[2001:db8::1]'), '2001:db8::1');
  assert.throws(() => normalizeIpLiteral('198.51.100.7:443'), /invalid/);
});

test('Research direct-address mode rejects forwarded headers instead of trusting client input', () => {
  const keyGenerator = createResearchClientAddressKeyGenerator({ trustedProxyHops: 0 });
  assert.equal(keyGenerator(request({ remoteAddress: '198.51.100.7' })), '198.51.100.7');
  assert.throws(
    () => keyGenerator(request({ remoteAddress: '198.51.100.7', forwardedFor: '203.0.113.8' })),
    /not allowed without trusted proxy/
  );
});

test('Research proxy mode trusts only the right side of an explicitly verified proxy topology', () => {
  const trusted = new Set(['10.0.0.1', '10.0.0.2']);
  const keyGenerator = createResearchClientAddressKeyGenerator({
    trustedProxyHops: 2,
    isTrustedProxyAddress: (value) => trusted.has(value)
  });

  assert.equal(
    keyGenerator(request({
      remoteAddress: '10.0.0.2',
      forwardedFor: '192.0.2.66, 198.51.100.7, 10.0.0.1'
    })),
    '198.51.100.7'
  );
});

test('Research proxy mode fails closed for untrusted direct or intermediate proxy hops', () => {
  const trusted = new Set(['10.0.0.1', '10.0.0.2']);
  const keyGenerator = createResearchClientAddressKeyGenerator({
    trustedProxyHops: 2,
    isTrustedProxyAddress: (value) => trusted.has(value)
  });

  assert.throws(
    () => keyGenerator(request({ remoteAddress: '198.51.100.9', forwardedFor: '198.51.100.7, 10.0.0.1' })),
    /direct peer is not a trusted proxy/
  );
  assert.throws(
    () => keyGenerator(request({ remoteAddress: '10.0.0.2', forwardedFor: '198.51.100.7, 192.0.2.20' })),
    /untrusted proxy hop/
  );
});

test('Research forwarded chain and hop count are bounded and malformed values fail closed', () => {
  assert.equal(MAX_RESEARCH_FORWARDED_CHAIN_LENGTH, 8);
  assert.equal(MAX_RESEARCH_TRUSTED_PROXY_HOPS, 4);
  assert.throws(() => createResearchClientAddressKeyGenerator({ trustedProxyHops: 5 }), /hop count is invalid/);
  assert.throws(() => createResearchClientAddressKeyGenerator({ trustedProxyHops: 1 }), /address policy is required/);
  assert.throws(() => parseForwardedFor('198.51.100.7,not-an-ip'), /invalid/);
  assert.throws(
    () => parseForwardedFor(Array.from({ length: 9 }, (_, i) => `198.51.100.${i + 1}`).join(',')),
    /chain is invalid/
  );
});

test('Research client-address resolver remains detached until deployment-specific trust evidence is approved', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'research-app.js'), 'utf8');
  const mountSource = fs.readFileSync(path.join(__dirname, '..', 'researchPublicApiMount.js'), 'utf8');
  const combined = appSource + '\n' + mountSource;
  assert.doesNotMatch(combined, /researchClientAddressKeyPolicy|createResearchClientAddressKeyGenerator/);
});
