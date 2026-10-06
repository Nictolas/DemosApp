const REQUIRED_RESEARCH_DATABASE_DECISIONS = Object.freeze([
  'dedicatedResearchDatabaseRequired',
  'identityDatabaseCredentialsForbidden',
  'tlsRequiredOutsideLocalDevelopment',
  'leastPrivilegeRoleRequired',
  'connectionSecretStoredOutsideSourceControl',
  'dataRegionApproved',
  'poolConcurrencyBounded',
  'connectionTimeoutDefined',
  'queryTimeoutDefined',
  'statementTimeoutDefined'
]);

const evaluateResearchDatabaseConfiguration = (decisions = {}) => {
  const blockers = REQUIRED_RESEARCH_DATABASE_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_RESEARCH_DATABASE_DECISIONS,
  evaluateResearchDatabaseConfiguration
};
