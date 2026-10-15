const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ACTION_CATALOG,
  RECOMMENDED_ACTIONS,
  APPROVAL_ACTIONS,
  BOUNDARY_ACTIONS,
  validateActionCatalog,
  actionCatalogStatus
} = require('../security-agent/securityActionCatalog');
const { RECOMMENDED_ACTIONS: AI_ACTIONS } = require('../security-agent/securityAiAnalystContract');
const { ACTION_POLICY, evaluateActionPolicy } = require('../security-agent/securityPolicyEngine');
const { SecurityApprovalGate } = require('../security-agent/securityApprovalGate');
const { buildExecutionBoundary } = require('../security-agent/securityExecutionBoundary');
const { validateExecutionBoundary } = require('../security-agent/securityExecutionBoundaryValidator');

const NOW = new Date('2026-10-06T10:00:00Z');

test('catalog validates as one bounded source of truth', () => {
  const result = validateActionCatalog();
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.actionCount, 8);
  assert.equal(result.approvalActionCount, 7);
  assert.equal(result.boundaryActionCount, 7);
  assert.equal(result.defaultUnknownDecision, 'deny');
  assert.equal(result.executable, false);
  assert.equal(result.actionRunnerAvailable, false);
  assert.equal(Object.isFrozen(ACTION_CATALOG), true);
  assert.deepEqual(ACTION_CATALOG.propose_deploy_rollback, {
    policyDecision: 'escalate',
    approvalEligible: true,
    boundaryEligible: true,
    effectClass: 'proposal_only'
  });
});

test('AI contract and policy engine derive the exact catalog action set', () => {
  assert.deepEqual([...AI_ACTIONS].sort(), [...RECOMMENDED_ACTIONS].sort());
  assert.deepEqual(Object.keys(ACTION_POLICY).sort(), [...RECOMMENDED_ACTIONS].sort());
  assert.equal(new Set(RECOMMENDED_ACTIONS).size, RECOMMENDED_ACTIONS.length);
});

test('catalog policy semantics preserve read-only observe and human escalation for every other action', () => {
  for (const action of RECOMMENDED_ACTIONS) {
    const result = evaluateActionPolicy(action, { priority: 'P2' });
    assert.equal(result.executable, false, action);
    if (action === 'observe') assert.equal(result.decision, 'allow');
    else assert.equal(result.decision, 'escalate', action);
  }
});

test('every approval action can traverse approval and boundary validation but remains non-executable', () => {
  assert.deepEqual([...APPROVAL_ACTIONS].sort(), [...BOUNDARY_ACTIONS].sort());
  for (const action of APPROVAL_ACTIONS) {
    const gate = new SecurityApprovalGate({ now: () => new Date(NOW), ttlMs: 30 * 60 * 1000 });
    const pending = gate.request({ action, priority: 'P1' });
    const approved = gate.decide(pending.approvalId, 'approved');
    const boundary = buildExecutionBoundary(approved, { now: () => new Date(NOW) });
    const validation = validateExecutionBoundary(boundary, { now: () => new Date(NOW) });
    assert.equal(validation.ok, true, action);
    assert.equal(boundary.authorized, false, action);
    assert.equal(boundary.executable, false, action);
    assert.equal(boundary.actionRunnerAvailable, false, action);
  }
});

test('observe and unknown actions cannot enter approval or execution boundary', () => {
  const gate = new SecurityApprovalGate({ now: () => new Date(NOW) });
  assert.throws(() => gate.request({ action: 'observe' }), /APPROVAL_ACTION_NOT_ALLOWED/);
  assert.throws(() => gate.request({ action: 'delete_everything' }), /APPROVAL_ACTION_NOT_ALLOWED/);
  assert.equal(evaluateActionPolicy('delete_everything', { priority: 'P1' }).decision, 'deny');
  assert.throws(() => buildExecutionBoundary({ approvalId: 'apr_x', action: 'observe', priority: 'P3', state: 'approved' }), /BOUNDARY_ACTION_NOT_ALLOWED/);
});

test('catalog status exposes no execution capability', () => {
  const status = actionCatalogStatus();
  assert.equal(status.ok, true);
  assert.equal(status.actionCount, 8);
  assert.equal(status.defaultUnknownDecision, 'deny');
  assert.equal(status.executable, false);
  assert.equal(status.actionRunnerAvailable, false);
});
