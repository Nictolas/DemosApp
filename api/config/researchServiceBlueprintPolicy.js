const REQUIRED_RESEARCH_SERVICE_BLUEPRINT_DECISIONS = Object.freeze([
  'dedicatedResearchServiceDefined',
  'researchEntrypointDefined',
  'identityRuntimeSeparated',
  'researchDatabaseSecretOnly',
  'identityDatabaseSecretsForbidden',
  'productionEnvironmentDefined',
  'healthCheckDefined',
  'autoDeployPolicyDefined',
  'publicExposurePolicyDefined',
  'rollbackProcedureDefined'
]);

const evaluateResearchServiceBlueprint = (decisions = {}) => {
  const blockers = REQUIRED_RESEARCH_SERVICE_BLUEPRINT_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_RESEARCH_SERVICE_BLUEPRINT_DECISIONS,
  evaluateResearchServiceBlueprint
};
