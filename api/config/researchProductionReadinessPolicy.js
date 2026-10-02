const REQUIRED_RESEARCH_PRODUCTION_DECISIONS = Object.freeze([
  'researchDatabaseConfigured',
  'researchSchemaValidated',
  'serviceBlueprintConfigured',
  'publicOriginsApproved',
  'telemetrySinkApproved',
  'researchSastCleared',
  'globalSastDebtCleared',
  'productionApprovalRecorded'
]);

const evaluateResearchProductionReadiness = (
  decisions = {},
  evidence = {}
) => {
  const blockers = REQUIRED_RESEARCH_PRODUCTION_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  if (evidence.rateLimitSecretLifecycle?.approved !== true) {
    blockers.push('rateLimitSecretLifecycleApproved');
  }
  if (evidence.distributedRateLimitProvider?.approved !== true) {
    blockers.push('distributedRateLimitProviderApproved');
  }
  if (evidence.telemetryRetention?.approved !== true) {
    blockers.push('telemetryRetentionApproved');
  }

  return Object.freeze({
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_RESEARCH_PRODUCTION_DECISIONS,
  evaluateResearchProductionReadiness
};
