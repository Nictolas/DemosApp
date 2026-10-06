const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RENDER_RESEARCH_CLIENT_ADDRESS_HEADER,
  REQUIRED_RENDER_CLIENT_ADDRESS_PROFILE_DECISIONS,
  evaluateResearchRenderClientAddressProfile
} = require('../config/researchRenderClientAddressProfilePolicy');

const allApproved = () => Object.fromEntries(
  REQUIRED_RENDER_CLIENT_ADDRESS_PROFILE_DECISIONS.map((key) => [key, true])
);

test('Research Render client-address profile is fail-closed by default', () => {
  const result = evaluateResearchRenderClientAddressProfile();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_RENDER_CLIENT_ADDRESS_PROFILE_DECISIONS);
  assert.equal(result.headerName, 'CF-Connecting-IP');
  assert.equal(RENDER_RESEARCH_CLIENT_ADDRESS_HEADER, 'CF-Connecting-IP');
});

test('Research Render client-address profile requires exact boolean evidence', () => {
  const decisions = allApproved();
  decisions.cfConnectingIpOverwriteVerified = 'true';
  const result = evaluateResearchRenderClientAddressProfile(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['cfConnectingIpOverwriteVerified']);
});

test('Research Render client-address profile approves only complete ingress evidence', () => {
  const result = evaluateResearchRenderClientAddressProfile(allApproved());
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.headerName, 'CF-Connecting-IP');
});
