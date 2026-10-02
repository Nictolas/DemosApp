const {
  evaluateResearchProductionReadiness
} = require('./config/researchProductionReadinessPolicy');
const {
  mountResearchPublicApiIfEnabled
} = require('./researchPublicApiMount');

const mountResearchPublicApiIfProductionReady = (app, options = {}) => {
  const evidence = {
    researchDatabaseConfiguration: options.researchDatabaseConfiguration,
    researchSchemaValidation: options.researchSchemaValidation,
    researchSastEvidence: options.researchSastEvidence,
    researchServiceBlueprint: options.researchServiceBlueprint,
    rateLimitSecretLifecycle: options.rateLimitSecretLifecycle,
    distributedRateLimitProvider: options.distributedRateLimitProvider,
    telemetryRetention: options.telemetryRetention,
    telemetrySink: options.telemetrySink,
    publicOrigins: options.publicOrigins
  };
  const readiness = evaluateResearchProductionReadiness(options.decisions, evidence);

  if (!readiness.ready) {
    return { mounted: false, blockers: readiness.blockers };
  }

  const mount = options.mount || mountResearchPublicApiIfEnabled;
  const result = mount(app, options.mountOptions);
  return { ...result, blockers: Object.freeze([]) };
};

module.exports = {
  mountResearchPublicApiIfProductionReady
};
