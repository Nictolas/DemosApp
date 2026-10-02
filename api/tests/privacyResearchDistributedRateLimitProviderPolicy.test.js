const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_DISTRIBUTED_RATE_LIMIT_PROVIDER_DECISIONS,
  evaluateResearchDistributedRateLimitProvider
} = require('../config/researchDistributedRateLimitProviderPolicy');

test('Research distributed rate-limit provider policy is fail-closed by default', () => {
  const result = evaluateResearchDistributedRateLimitProvider();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_DISTRIBUTED_RATE_LIMIT_PROVIDER_DECISIONS);
});

test('Research distributed rate-limit provider requires explicit boolean decisions', () => {
  const decisions = Object.fromEntries(
    REQUIRED_DISTRIBUTED_RATE_LIMIT_PROVIDER_DECISIONS.map((key) => [key, true])
  );
  decisions.dataRegionApproved = 'true';

  const result = evaluateResearchDistributedRateLimitProvider(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['dataRegionApproved']);
});

test('Research distributed rate-limit provider requires privacy and isolation safeguards', () => {
  const decisions = Object.fromEntries(
    REQUIRED_DISTRIBUTED_RATE_LIMIT_PROVIDER_DECISIONS.map((key) => [key, true])
  );
  decisions.noRawCitizenIdentifierStored = false;
  decisions.researchNamespaceIsolated = false;

  const result = evaluateResearchDistributedRateLimitProvider(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, [
    'researchNamespaceIsolated',
    'noRawCitizenIdentifierStored'
  ]);
});

test('Research distributed rate-limit provider approves only after every safeguard is recorded', () => {
  const decisions = Object.fromEntries(
    REQUIRED_DISTRIBUTED_RATE_LIMIT_PROVIDER_DECISIONS.map((key) => [key, true])
  );

  const result = evaluateResearchDistributedRateLimitProvider(decisions);
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
