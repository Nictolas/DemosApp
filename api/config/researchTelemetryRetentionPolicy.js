const REQUIRED_TELEMETRY_RETENTION_DECISIONS = Object.freeze([
  'retentionWindowDefined',
  'automaticExpiryEnforced',
  'deletionVerificationDefined',
  'noRawCitizenIdentifierRetained',
  'noPoliticalOpinionPayloadRetained',
  'noCredentialMaterialRetained',
  'retentionLimitedToOperationalNeed',
  'indefiniteRetentionDisabled'
]);

const evaluateResearchTelemetryRetention = (decisions = {}) => {
  const blockers = REQUIRED_TELEMETRY_RETENTION_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_TELEMETRY_RETENTION_DECISIONS,
  evaluateResearchTelemetryRetention
};
