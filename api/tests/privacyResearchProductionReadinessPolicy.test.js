const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
  evaluateResearchProductionReadiness
} = require('../config/researchProductionReadinessPolicy');

const approved = Object.freeze({ approved: true, blockers: Object.freeze([]) });
const evidence = () => ({
  researchDatabaseConfiguration: approved,
  researchSchemaValidation: approved,
  researchSastEvidence: approved,
  researchServiceBlueprint: approved,
  rateLimitSecretLifecycle: approved,
  distributedRateLimitProvider: approved,
  telemetryRetention: approved,
  telemetrySink: approved,
  publicOrigins: approved
});
const allReady = () => Object.fromEntries(
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS.map((key) => [key, true])
);

test('Research production readiness is fail-closed by default', () => {
  const result = evaluateResearchProductionReadiness();
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    ...REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
    'researchDatabaseConfigured',
    'researchSchemaValidated',
    'researchSastCleared',
    'serviceBlueprintConfigured',
    'rateLimitSecretLifecycleApproved',
    'distributedRateLimitProviderApproved',
    'telemetryRetentionApproved',
    'telemetrySinkApproved',
    'publicOriginsApproved'
  ]);
});

test('Research production readiness requires service blueprint evidence', () => {
  const partial = evidence();
  delete partial.researchServiceBlueprint;
  const result = evaluateResearchProductionReadiness(allReady(), partial);
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['serviceBlueprintConfigured']);
});

test('Research production readiness becomes true only with decisions and all evidences', () => {
  const result = evaluateResearchProductionReadiness(allReady(), evidence());
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test('Research readiness no longer accepts a manually asserted global SAST decision', () => {
  const decisions = { ...allReady(), globalSastDebtCleared: false };
  const result = evaluateResearchProductionReadiness(decisions, evidence());
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});
