const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REQUIRED_RESEARCH_SCHEMA_DECISIONS,
  evaluateResearchSchemaValidation
} = require('../config/researchSchemaValidationPolicy');

const allApproved = () => Object.fromEntries(
  REQUIRED_RESEARCH_SCHEMA_DECISIONS.map((key) => [key, true])
);

test('Research schema validation is fail-closed by default', () => {
  const result = evaluateResearchSchemaValidation();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_RESEARCH_SCHEMA_DECISIONS);
});

test('Research schema validation requires explicit booleans', () => {
  const decisions = allApproved();
  decisions.identityTablesExcluded = 'true';
  const result = evaluateResearchSchemaValidation(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['identityTablesExcluded']);
});

test('Research schema validation blocks identity linkage safeguards when incomplete', () => {
  const decisions = allApproved();
  decisions.directCitizenIdentifiersExcluded = false;
  decisions.foreignKeysToIdentityForbidden = false;
  const result = evaluateResearchSchemaValidation(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, [
    'directCitizenIdentifiersExcluded',
    'foreignKeysToIdentityForbidden'
  ]);
});

test('Research schema validation approves only the complete contract', () => {
  const result = evaluateResearchSchemaValidation(allApproved());
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
