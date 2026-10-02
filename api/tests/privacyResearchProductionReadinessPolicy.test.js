const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
  evaluateResearchProductionReadiness
} = require('../config/researchProductionReadinessPolicy');

test('Research production readiness is fail-closed by default', () => {
  const result = evaluateResearchProductionReadiness();

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, REQUIRED_RESEARCH_PRODUCTION_DECISIONS);
});

test('Research production readiness requires explicit boolean true for every decision', () => {
  const decisions = Object.fromEntries(
    REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
  );
  decisions.telemetryRetentionApproved = 'true';

  const result = evaluateResearchProductionReadiness(decisions);

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['telemetryRetentionApproved']);
});

test('Research production readiness becomes true only when every prerequisite is recorded', () => {
  const decisions = Object.fromEntries(
    REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
  );

  const result = evaluateResearchProductionReadiness(decisions);

  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test('Research readiness contract includes security and explicit production approval gates', () => {
  for (const required of [
    'sastGateCleared',
    'productionApprovalRecorded',
    'rateLimitSecretLifecycleApproved',
    'telemetryRetentionApproved',
    'publicOriginsApproved'
  ]) {
    assert.equal(REQUIRED_RESEARCH_PRODUCTION_DECISIONS.includes(required), true);
  }
});
