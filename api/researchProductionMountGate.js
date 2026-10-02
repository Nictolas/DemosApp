const {
  evaluateResearchProductionReadiness
} = require('./config/researchProductionReadinessPolicy');
const {
  mountResearchPublicApiIfEnabled
} = require('./researchPublicApiMount');
const {
  verifyResearchReadinessManifest
} = require('./config/researchReadinessManifest');

const mountResearchPublicApiIfProductionReady = (app, options = {}) => {
  const verifiedManifest = verifyResearchReadinessManifest({
    manifest: options.readinessManifest,
    signature: options.readinessManifestSignature,
    publicKey: options.readinessManifestPublicKey,
    now: options.now
  });
  const evidence = verifiedManifest.valid ? verifiedManifest.evidence : {};
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
