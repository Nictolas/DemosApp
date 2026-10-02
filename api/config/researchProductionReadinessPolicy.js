const REQUIRED_RESEARCH_PRODUCTION_DECISIONS = Object.freeze([
  'researchDatabaseConfigured',
  'researchSchemaValidated',
  'serviceBlueprintConfigured',
  'publicOriginsApproved',
  'distributedRateLimitProviderApproved',
  'rateLimitSecretLifecycleApproved',
  'telemetrySinkApproved',
  'telemetryRetentionApproved',
  'sastGateCleared',
  'productionApprovalRecorded'
]);

const evaluateResearchProductionReadiness = (decisions = {}) => {
  const blockers = REQUIRED_RESEARCH_PRODUCTION_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
  evaluateResearchProductionReadiness
};
