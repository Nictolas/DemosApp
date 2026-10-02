const REQUIRED_RESEARCH_SAST_EVIDENCE = Object.freeze([
  'researchScopeScanPassed',
  'incrementalScanPassed',
  'runtimeManifestValidated',
  'deterministicSecurityTestsPassed',
  'secretScanPassed'
]);

const evaluateResearchSastEvidence = (evidence = {}) => {
  const blockers = REQUIRED_RESEARCH_SAST_EVIDENCE.filter(
    (key) => evidence[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_RESEARCH_SAST_EVIDENCE,
  evaluateResearchSastEvidence
};
