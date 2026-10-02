const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REQUIRED_RESEARCH_SAST_EVIDENCE,
  evaluateResearchSastEvidence
} = require('../config/researchSastEvidencePolicy');

const allPassed = () => Object.fromEntries(
  REQUIRED_RESEARCH_SAST_EVIDENCE.map((key) => [key, true])
);

test('Research SAST evidence is fail-closed by default', () => {
  const result = evaluateResearchSastEvidence();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_RESEARCH_SAST_EVIDENCE);
});

test('Research SAST evidence requires explicit booleans', () => {
  const evidence = allPassed();
  evidence.researchScopeScanPassed = 'true';
  const result = evaluateResearchSastEvidence(evidence);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['researchScopeScanPassed']);
});

test('Research SAST evidence keeps incremental and manifest validation mandatory', () => {
  const evidence = allPassed();
  evidence.incrementalScanPassed = false;
  evidence.runtimeManifestValidated = false;
  const result = evaluateResearchSastEvidence(evidence);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, [
    'incrementalScanPassed',
    'runtimeManifestValidated'
  ]);
});

test('Research SAST evidence approves only the complete contract', () => {
  const result = evaluateResearchSastEvidence(allPassed());
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
