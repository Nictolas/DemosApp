const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RESEARCH_FAILURE_KIND,
  classifyResearchFailure
} = require('../services/researchFailureClassification');

test('Research failure classification separates request, policy and infrastructure internally', () => {
  assert.deepEqual(classifyResearchFailure(new Error('Invalid participant public key')), { kind: RESEARCH_FAILURE_KIND.REQUEST });
  assert.deepEqual(classifyResearchFailure(new Error('privacy threshold not met')), { kind: RESEARCH_FAILURE_KIND.POLICY });
  assert.deepEqual(classifyResearchFailure(new Error('Research database unavailable')), { kind: RESEARCH_FAILURE_KIND.INFRASTRUCTURE });
});

test('Research failure classification never retains original error details', () => {
  const secret = 'E408_SECRET_SENTINEL';
  const result = classifyResearchFailure(new Error(`connect failed password=${secret}`));
  assert.deepEqual(Object.keys(result), ['kind']);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(Object.isFrozen(result), true);
});

test('unknown values classify fail-closed as request failures', () => {
  assert.deepEqual(classifyResearchFailure(null), { kind: RESEARCH_FAILURE_KIND.REQUEST });
  assert.deepEqual(classifyResearchFailure({}), { kind: RESEARCH_FAILURE_KIND.REQUEST });
});
