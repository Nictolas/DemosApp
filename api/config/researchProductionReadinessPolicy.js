const REQUIRED_RESEARCH_PRODUCTION_DECISIONS = Object.freeze([
  'serviceBlueprintConfigured',
  'globalSastDebtCleared',
  'productionApprovalRecorded'
]);

const evaluateResearchProductionReadiness = (decisions = {}, evidence = {}) => {
  const blockers = REQUIRED_RESEARCH_PRODUCTION_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  const requiredEvidence = [
    ['researchDatabaseConfiguration', 'researchDatabaseConfigured'],
    ['researchSchemaValidation', 'researchSchemaValidated'],
    ['researchSastEvidence', 'researchSastCleared'],
    ['rateLimitSecretLifecycle', 'rateLimitSecretLifecycleApproved'],
    ['distributedRateLimitProvider', 'distributedRateLimitProviderApproved'],
    ['telemetryRetention', 'telemetryRetentionApproved'],
    ['telemetrySink', 'telemetrySinkApproved'],
    ['publicOrigins', 'publicOriginsApproved']
  ];

  for (const [key, blocker] of requiredEvidence) {
    if (evidence[key]?.approved !== true) {
      blockers.push(blocker);
    }
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
