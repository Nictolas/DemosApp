const REQUIRED_RESEARCH_PRODUCTION_DECISIONS = Object.freeze([
  'researchDatabaseConfigured',
  'researchSchemaValidated',
  'serviceBlueprintConfigured',
  'publicOriginsApproved',
  'telemetrySinkApproved',
  'telemetryRetentionApproved',
  'researchSastCleared',
  'globalSastDebtCleared',
  'productionApprovalRecorded'
]);

const evaluateResearchProductionReadiness = (
  decisions = {},
  {
    rateLimitSecretLifecycle,
    distributedRateLimitProvider
  } = {}
) => {
  const blockers = REQUIRED_RESEARCH_PRODUCTION_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  if (rateLimitSecretLifecycle?.approved !== true) {
    blockers.push('rateLimitSecretLifecycleApproved');
  }
  if (distributedRateLimitProvider?.approved !== true) {
    blockers.push('distributedRateLimitProviderApproved');
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
