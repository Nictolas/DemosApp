const {
  evaluateResearchProductionReadiness
} = require('./config/researchProductionReadinessPolicy');
const {
  mountResearchPublicApiIfEnabled
} = require('./researchPublicApiMount');

const mountResearchPublicApiIfProductionReady = (
  app,
  {
    decisions,
    mount = mountResearchPublicApiIfEnabled,
    mountOptions
  } = {}
) => {
  const readiness = evaluateResearchProductionReadiness(decisions);

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
