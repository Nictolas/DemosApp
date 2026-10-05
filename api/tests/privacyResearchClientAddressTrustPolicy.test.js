const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_RESEARCH_CLIENT_ADDRESS_TRUST_DECISIONS,
  evaluateResearchClientAddressTrust
} = require('../config/researchClientAddressTrustPolicy');

const allApproved = () => Object.fromEntries(
  REQUIRED_RESEARCH_CLIENT_ADDRESS_TRUST_DECISIONS.map((key) => [key, true])
);

test('Research client-address trust is fail-closed until deployment proxy evidence exists', () => {
  const result = evaluateResearchClientAddressTrust();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_RESEARCH_CLIENT_ADDRESS_TRUST_DECISIONS);
});

test('Research client-address trust requires exact boolean evidence', () => {
  const decisions = allApproved();
  decisions.forwardedForSanitizationVerified = 'true';
  decisions.directAccessBypassPrevented = false;
  const result = evaluateResearchClientAddressTrust(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, [
    'forwardedForSanitizationVerified',
    'directAccessBypassPrevented'
  ]);
});

test('Research client-address trust approves only after every proxy safeguard is recorded', () => {
  const result = evaluateResearchClientAddressTrust(allApproved());
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
