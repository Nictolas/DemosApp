const REQUIRED_TELEMETRY_SINK_DECISIONS = Object.freeze([
  'transportEncryptionRequired',
  'storageEncryptionRequired',
  'accessRestrictedToAuthorizedResearchOperations',
  'researchTelemetryIsolated',
  'dataRegionApproved',
  'retentionPolicyEnforceable',
  'noRawCitizenIdentifierAccepted',
  'noPoliticalOpinionPayloadAccepted',
  'noCredentialMaterialAccepted'
]);

const evaluateResearchTelemetrySink = (decisions = {}) => {
  const blockers = REQUIRED_TELEMETRY_SINK_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_TELEMETRY_SINK_DECISIONS,
  evaluateResearchTelemetrySink
};
