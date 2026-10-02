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
  const rateLimitSecretLifecycle = options.rateLimitSecretLifecycle;
  const distributedRateLimitProvider = options.distributedRateLimitProvider;
  const mount = options.mount || mountResearchPublicApiIfEnabled;
  const mountOptions = options.mountOptions;

  const readiness = evaluateResearchProductionReadiness(decisions, {
    rateLimitSecretLifecycle,
    distributedRateLimitProvider
  });

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
