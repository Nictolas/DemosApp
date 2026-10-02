const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
  evaluateResearchProductionReadiness
} = require('../config/researchProductionReadinessPolicy');

const approved = Object.freeze({ approved: true, blockers: Object.freeze([]) });
const evidence = () => ({
  rateLimitSecretLifecycle: approved,
  distributedRateLimitProvider: approved,
  telemetryRetention: approved
});

test('Research production readiness is fail-closed by default', () => {
  const result = evaluateResearchProductionReadiness();
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    ...REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
    'rateLimitSecretLifecycleApproved',
    'distributedRateLimitProviderApproved',
    'telemetryRetentionApproved'
  ]);
});

test('Research production readiness requires explicit boolean true for every decision', () => {
  const decisions = Object.fromEntries(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true]));
  decisions.telemetrySinkApproved = 'true';
  const result = evaluateResearchProductionReadiness(decisions, evidence());
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['telemetrySinkApproved']);
});

test('Research production readiness requires all policy evidences', () => {
  const decisions = Object.fromEntries(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true]));
  const withoutRetention = evidence();
  delete withoutRetention.telemetryRetention;
  const result = evaluateResearchProductionReadiness(decisions, withoutRetention);
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['telemetryRetentionApproved']);
});

test('Research production readiness becomes true only with decisions and all policy evidences', () => {
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
