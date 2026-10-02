const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
  evaluateResearchProductionReadiness
} = require('../config/researchProductionReadinessPolicy');

const approvedLifecycle = Object.freeze({ approved: true, blockers: Object.freeze([]) });

test('Research production readiness is fail-closed by default', () => {
  const result = evaluateResearchProductionReadiness();

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    ...REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
    'rateLimitSecretLifecycleApproved'
  ]);
});

test('Research production readiness requires explicit boolean true for every decision', () => {
  const decisions = Object.fromEntries(
    REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
  );
  decisions.telemetryRetentionApproved = 'true';

  const result = evaluateResearchProductionReadiness(decisions, {
    rateLimitSecretLifecycle: approvedLifecycle
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['telemetryRetentionApproved']);
});

test('Research production readiness requires approved rate-limit secret lifecycle evidence', () => {
  const decisions = Object.fromEntries(
    REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
  );

  const missing = evaluateResearchProductionReadiness(decisions);
  assert.equal(missing.ready, false);
  assert.deepEqual(missing.blockers, ['rateLimitSecretLifecycleApproved']);

  const rejected = evaluateResearchProductionReadiness(decisions, {
    rateLimitSecretLifecycle: { approved: false, blockers: ['rotationProcedureDocumented'] }
  });
  assert.equal(rejected.ready, false);
  assert.deepEqual(rejected.blockers, ['rateLimitSecretLifecycleApproved']);
});

test('Research production readiness becomes true only with decisions and lifecycle evidence', () => {
  const decisions = Object.fromEntries(
    REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
  );

  const result = evaluateResearchProductionReadiness(decisions, {
    rateLimitSecretLifecycle: approvedLifecycle
  });

  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test('Research readiness distinguishes Research SAST evidence from global SAST debt', () => {
  assert.equal(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.includes('researchSastCleared'), true);
  assert.equal(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.includes('globalSastDebtCleared'), true);

  const researchCleanOnly = Object.fromEntries(
    REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
  );
  researchCleanOnly.globalSastDebtCleared = false;

  const result = evaluateResearchProductionReadiness(researchCleanOnly, {
    rateLimitSecretLifecycle: approvedLifecycle
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['globalSastDebtCleared']);
});

test('Research readiness contract includes security and explicit production approval gates', () => {
  for (const required of [
    'researchSastCleared',
    'globalSastDebtCleared',
    'productionApprovalRecorded',
    'telemetryRetentionApproved',
    'publicOriginsApproved'
  ]) {
    assert.equal(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.includes(required), true);
  }
});
