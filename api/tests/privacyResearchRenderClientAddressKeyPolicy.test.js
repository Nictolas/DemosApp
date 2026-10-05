const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  REQUIRED_RENDER_CLIENT_ADDRESS_PROFILE_DECISIONS
} = require('../config/researchRenderClientAddressProfilePolicy');
const {
  parseTrustedSingleIpHeader,
  createResearchRenderClientAddressKeyGenerator
} = require('../services/researchRenderClientAddressKeyPolicy');

const allApproved = () => Object.fromEntries(
  REQUIRED_RENDER_CLIENT_ADDRESS_PROFILE_DECISIONS.map((key) => [key, true])
);

const request = ({ cfConnectingIp, forwardedFor } = {}) => ({
  headers: {
    'cf-connecting-ip': cfConnectingIp,
    'x-forwarded-for': forwardedFor
  }
});

test('Research Render client-key generator refuses incomplete provider evidence', () => {
  const decisions = allApproved();
  decisions.directServicePortNotPubliclyReachableVerified = false;
  assert.throws(
    () => createResearchRenderClientAddressKeyGenerator({ profileDecisions: decisions }),
    /directServicePortNotPubliclyReachableVerified/
  );
});

test('Research Render client-key generator uses only the trusted single-IP header', () => {
  const generator = createResearchRenderClientAddressKeyGenerator({ profileDecisions: allApproved() });
  const key = generator(request({
    cfConnectingIp: '198.51.100.77',
    forwardedFor: '203.0.113.200, 203.0.113.201'
  }));
  assert.equal(key, '198.51.100.77');
});

test('Research Render trusted header accepts IPv6 and IPv4-mapped literals', () => {
  assert.equal(parseTrustedSingleIpHeader('2001:db8::1'), '2001:db8::1');
  assert.equal(parseTrustedSingleIpHeader('::ffff:198.51.100.77'), '198.51.100.77');
});

test('Research Render trusted header rejects missing, chained or malformed values', () => {
  assert.throws(() => parseTrustedSingleIpHeader(undefined), /header is invalid/);
  assert.throws(() => parseTrustedSingleIpHeader('198.51.100.1, 198.51.100.2'), /header is invalid/);
  assert.throws(() => parseTrustedSingleIpHeader('not-an-ip'), /client address is invalid/);
});

test('Research Render client-key policy remains shadow-only and is not wired into public runtime', () => {
  const files = ['research-app.js', 'researchPublicApiMount.js', 'routes/researchPublicRouter.js'];
  const source = files.map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /researchRenderClientAddressKeyPolicy|createResearchRenderClientAddressKeyGenerator/);
});
