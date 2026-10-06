const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REQUIRED_RESEARCH_DATABASE_DECISIONS,
  evaluateResearchDatabaseConfiguration
} = require('../config/researchDatabaseConfigurationPolicy');

const allApproved = () => Object.fromEntries(
  REQUIRED_RESEARCH_DATABASE_DECISIONS.map((key) => [key, true])
);

test('Research database configuration is fail-closed by default', () => {
  const result = evaluateResearchDatabaseConfiguration();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_RESEARCH_DATABASE_DECISIONS);
});

test('Research database configuration requires explicit booleans', () => {
  const decisions = allApproved();
  decisions.leastPrivilegeRoleRequired = 'true';
  const result = evaluateResearchDatabaseConfiguration(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['leastPrivilegeRoleRequired']);
});

test('Research database configuration rejects incomplete safeguards', () => {
  const decisions = allApproved();
  decisions.identityDatabaseCredentialsForbidden = false;
  decisions.dataRegionApproved = false;
  const result = evaluateResearchDatabaseConfiguration(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, [
    'identityDatabaseCredentialsForbidden',
    'dataRegionApproved'
  ]);
});

test('Research database configuration approves only the complete contract', () => {
  const result = evaluateResearchDatabaseConfiguration(allApproved());
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
