const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
  evaluateResearchProductionReadiness
} = require('../config/researchProductionReadinessPolicy');

const approvedLifecycle = Object.freeze({ approved: true, blockers: Object.freeze([]) });
const approvedProvider = Object.freeze({ approved: true, blockers: Object.freeze([]) });
const evidence = () => ({
  rateLimitSecretLifecycle: approvedLifecycle,
  distributedRateLimitProvider: approvedProvider
});

test('Research production readiness is fail-closed by default', () => {
  const result = evaluateResearchProductionReadiness();
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    ...REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
    'rateLimitSecretLifecycleApproved',
    'distributedRateLimitProviderApproved'
  ]);
});

test('Research production readiness requires explicit boolean true for every decision', () => {
  const decisions = Object.fromEntries(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true]));
  decisions.telemetryRetentionApproved = 'true';
  const result = evaluateResearchProductionReadiness(decisions, evidence());
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['telemetryRetentionApproved']);
});

test('Research production readiness requires approved rate-limit evidence', () => {
  const decisions = Object.fromEntries(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true]));
  const missing = evaluateResearchProductionReadiness(decisions);
  assert.equal(missing.ready, false);
  assert.deepEqual(missing.blockers, ['rateLimitSecretLifecycleApproved', 'distributedRateLimitProviderApproved']);

  const lifecycleOnly = evaluateResearchProductionReadiness(decisions, {
    rateLimitSecretLifecycle: approvedLifecycle
  });
  assert.equal(lifecycleOnly.ready, false);
  assert.deepEqual(lifecycleOnly.blockers, ['distributedRateLimitProviderApproved']);
});

test('Research production readiness becomes true only with decisions and both rate-limit evidences', () => {
  const decisions = Object.fromEntries(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true]));
  const result = evaluateResearchProductionReadiness(decisions, evidence());
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test('Research readiness distinguishes Research SAST evidence from global SAST debt', () => {
  const decisions = Object.fromEntries(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true]));
  decisions.globalSastDebtCleared = false;
  const result = evaluateResearchProductionReadiness(decisions, evidence());
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['globalSastDebtCleared']);
});
