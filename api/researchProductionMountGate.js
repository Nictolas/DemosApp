const {
  evaluateResearchProductionReadiness
} = require('./config/researchProductionReadinessPolicy');
const {
  mountResearchPublicApiIfEnabled
} = require('./researchPublicApiMount');

const mountResearchPublicApiIfProductionReady = (
  app,
  options = {}
) => {
  const decisions = options.decisions;
  const evidence = {
    rateLimitSecretLifecycle: options.rateLimitSecretLifecycle,
    distributedRateLimitProvider: options.distributedRateLimitProvider,
    telemetryRetention: options.telemetryRetention
  };
  const mount = options.mount || mountResearchPublicApiIfEnabled;
  const mountOptions = options.mountOptions;

  const readiness = evaluateResearchProductionReadiness(decisions, evidence);

  if (!readiness.ready) {
    return {
      mounted: false,
      blockers: readiness.blockers
    };
  }

  const result = mount(app, mountOptions);

  return {
    ...result,
    blockers: Object.freeze([])
  };
};

module.exports = {
  mountResearchPublicApiIfProductionReady
};
