const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REQUIRED_RESEARCH_SERVICE_BLUEPRINT_DECISIONS,
  evaluateResearchServiceBlueprint
} = require('../config/researchServiceBlueprintPolicy');

const allApproved = () => Object.fromEntries(
  REQUIRED_RESEARCH_SERVICE_BLUEPRINT_DECISIONS.map((key) => [key, true])
);

test('Research service blueprint is fail-closed by default', () => {
  const result = evaluateResearchServiceBlueprint();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_RESEARCH_SERVICE_BLUEPRINT_DECISIONS);
});

test('Research service blueprint requires explicit booleans', () => {
  const decisions = allApproved();
  decisions.dedicatedResearchServiceDefined = 'true';
  const result = evaluateResearchServiceBlueprint(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['dedicatedResearchServiceDefined']);
});

test('Research service blueprint blocks identity runtime or secret reuse', () => {
  const decisions = allApproved();
  decisions.identityRuntimeSeparated = false;
  decisions.identityDatabaseSecretsForbidden = false;
  const result = evaluateResearchServiceBlueprint(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, [
    'identityRuntimeSeparated',
    'identityDatabaseSecretsForbidden'
  ]);
});

test('Research service blueprint approves only the complete contract', () => {
  const result = evaluateResearchServiceBlueprint(allApproved());
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
