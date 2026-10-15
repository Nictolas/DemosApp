const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ACTION_POLICY,
  evaluateActionPolicy,
  evaluateAiPolicy,
  policyStatus
} = require('../security-agent/securityPolicyEngine');

test('only passive observation is allow and remains non-executable', () => {
  const result = evaluateActionPolicy('observe', { priority: 'P3' });
  assert.equal(result.decision, 'allow');
  assert.equal(result.executable, false);
});

test('mitigation proposals require human escalation', () => {
  for (const action of ['investigate','escalate_human','propose_rate_limit','propose_session_revocation','propose_endpoint_isolation','propose_secret_rotation']) {
    const result = evaluateActionPolicy(action, { priority: 'P2' });
    assert.equal(result.decision, 'escalate', action);
    assert.equal(result.executable, false);
  }
});

test('unknown actions fail closed', () => {
  const result = evaluateActionPolicy('delete_everything', { priority: 'P1' });
  assert.deepEqual(result, { action: 'unknown', decision: 'deny', reasonCode: 'ACTION_NOT_ALLOWLISTED', executable: false });
});

test('P0 and explicit human-review flags escalate even observe', () => {
  assert.equal(evaluateActionPolicy('observe', { priority: 'P0' }).decision, 'escalate');
  assert.equal(evaluateActionPolicy('observe', { priority: 'P3', requiresHumanReview: true }).decision, 'escalate');
});

test('aggregate policy chooses the strictest decision', () => {
  const result = evaluateAiPolicy({
    prioritySuggestion: 'P2',
    requiresHumanReview: false,
    recommendedActions: ['observe', 'propose_rate_limit']
  });
  assert.equal(result.decision, 'escalate');
  assert.equal(result.executable, false);
  assert.equal(result.actions.length, 2);
});

test('invalid analysis or priority is denied', () => {
  assert.equal(evaluateAiPolicy(null).decision, 'deny');
  assert.equal(evaluateAiPolicy({ prioritySuggestion: 'PX', recommendedActions: ['observe'] }).decision, 'deny');
});

test('policy status proves no action runner exists', () => {
  const status = policyStatus();
  assert.equal(status.actionRunnerAvailable, false);
  assert.equal(status.executable, false);
  assert.equal(status.defaultUnknownDecision, 'deny');
  assert.equal(status.actionCount, Object.keys(ACTION_POLICY).length);
});
