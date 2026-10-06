const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_PUBLIC_ORIGIN_DECISIONS,
  evaluateResearchPublicOrigins
} = require('../config/researchPublicOriginsPolicy');

const allApproved = () => Object.fromEntries(
  REQUIRED_PUBLIC_ORIGIN_DECISIONS.map((key) => [key, true])
);

test('Research public origins policy is fail-closed by default', () => {
  const result = evaluateResearchPublicOrigins();
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, REQUIRED_PUBLIC_ORIGIN_DECISIONS);
});

test('Research public origins policy requires explicit booleans', () => {
  const decisions = allApproved();
  decisions.wildcardOriginsForbidden = 'true';
  const result = evaluateResearchPublicOrigins(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, ['wildcardOriginsForbidden']);
});

test('Research public origins policy rejects incomplete origin safeguards', () => {
  const decisions = allApproved();
  decisions.unknownOriginsRejected = false;
  decisions.httpsRequiredOutsideLocalDevelopment = false;
  const result = evaluateResearchPublicOrigins(decisions);
  assert.equal(result.approved, false);
  assert.deepEqual(result.blockers, [
    'httpsRequiredOutsideLocalDevelopment',
    'unknownOriginsRejected'
  ]);
});

test('Research public origins policy approves only all recorded safeguards', () => {
  const result = evaluateResearchPublicOrigins(allApproved());
  assert.equal(result.approved, true);
  assert.deepEqual(result.blockers, []);
});
