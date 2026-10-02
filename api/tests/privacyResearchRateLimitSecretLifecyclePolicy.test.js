const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_RATE_LIMIT_SECRET_DECISIONS,
  evaluateResearchRateLimitSecretLifecycle
} = require('../config/researchRateLimitSecretLifecyclePolicy');

test('Research rate-limit secret lifecycle is fail-closed by default', () => {
  const result = evaluateResearchRateLimitSecretLifecycle();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_RATE_LIMIT_SECRET_DECISIONS);
});

test('Research rate-limit secret lifecycle requires explicit boolean decisions', () => {
  const decisions = Object.fromEntries(
    REQUIRED_RATE_LIMIT_SECRET_DECISIONS.map((key) => [key, true])
  );
  decisions.rotationProcedureDocumented = 'true';

  const result = evaluateResearchRateLimitSecretLifecycle(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['rotationProcedureDocumented']);
});

test('Research rate-limit secret lifecycle requires separation from Identity secrets', () => {
  const decisions = Object.fromEntries(
    REQUIRED_RATE_LIMIT_SECRET_DECISIONS.map((key) => [key, true])
  );
  decisions.separateFromIdentitySecrets = false;

  const result = evaluateResearchRateLimitSecretLifecycle(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['separateFromIdentitySecrets']);
});

test('Research rate-limit secret lifecycle approves only after every safeguard is recorded', () => {
  const decisions = Object.fromEntries(
    REQUIRED_RATE_LIMIT_SECRET_DECISIONS.map((key) => [key, true])
  );

  const result = evaluateResearchRateLimitSecretLifecycle(decisions);
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
