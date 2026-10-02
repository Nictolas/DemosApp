const REQUIRED_RESEARCH_SCHEMA_DECISIONS = Object.freeze([
  'identityTablesExcluded',
  'directCitizenIdentifiersExcluded',
  'politicalOpinionsSeparatedFromIdentity',
  'credentialMaterialMinimized',
  'foreignKeysToIdentityForbidden',
  'retentionFieldsDefinedWhereRequired',
  'deletionPathDefined',
  'migrationRollbackDefined',
  'schemaValidationProcedureDefined'
]);

const evaluateResearchSchemaValidation = (decisions = {}) => {
  const blockers = REQUIRED_RESEARCH_SCHEMA_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_RESEARCH_SCHEMA_DECISIONS,
  evaluateResearchSchemaValidation
};
