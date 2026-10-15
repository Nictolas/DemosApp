const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAiPolicy } = require('../security-agent/securityPolicyEngine');
const { SecurityApprovalGate } = require('../security-agent/securityApprovalGate');
const { SecurityAiShadowIntegration } = require('../security-agent/securityAiShadowIntegration');
const { buildExecutionBoundary } = require('../security-agent/securityExecutionBoundary');
const { validateExecutionBoundary } = require('../security-agent/securityExecutionBoundaryValidator');
const { buildPolicyAuditEvidence } = require('../security-agent/securityPolicyAuditEvidence');

const NOW = new Date('2026-10-06T10:00:00Z');

function target(result) {
  return { status: () => ({ ready: true, simulated: true }), analyze: async () => result };
}
function integrationConfig() {
  return { version: 'v0.24', enabled: true, backend: 'mock', ready: true, blockers: Object.freeze([]) };
}
function analysis(actions, extra = {}) {
  return {
    assessment: 'suspicious', confidence: 90, prioritySuggestion: 'P1', summary: 'synthetic', hypotheses: [],
    recommendedActions: actions, requiresHumanReview: false, executable: false, toolCalls: [], ...extra
  };
}

test('P0 observe escalation routes to explicit human approval instead of rejected observe action', async () => {
  const gate = new SecurityApprovalGate({ now: () => new Date(NOW) });
  const ai = new SecurityAiShadowIntegration({
    config: integrationConfig(),
    mockRunner: target(analysis(['observe'], { prioritySuggestion: 'P0' })),
    approvalGate: gate,
    now: () => new Date(NOW)
  });
  const result = await ai.analyze({});
  assert.equal(result.policy.decision, 'escalate');
  const approvals = gate.list({ limit: 10 });
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].action, 'escalate_human');
  assert.equal(approvals[0].executable, false);
});

test('allow-only observation produces complete audit evidence with no approval', () => {
  const policy = evaluateAiPolicy({ prioritySuggestion: 'P3', requiresHumanReview: false, recommendedActions: ['observe'] });
  const evidence = buildPolicyAuditEvidence({ policy, approvals: [] });
  assert.equal(evidence.ok, true);
  assert.deepEqual(evidence.expectedApprovalActions, []);
  assert.equal(evidence.executable, false);
});

test('escalated proposal links policy, approved record, boundary and validator', () => {
  const gate = new SecurityApprovalGate({ now: () => new Date(NOW) });
  const policy = evaluateAiPolicy({ prioritySuggestion: 'P1', requiresHumanReview: false, recommendedActions: ['propose_rate_limit'] });
  const pending = gate.request({ action: 'propose_rate_limit', priority: 'P1' });
  const approved = gate.decide(pending.approvalId, 'approved');
  const boundary = buildExecutionBoundary(approved, { now: () => new Date(NOW) });
  const validation = validateExecutionBoundary(boundary, { now: () => new Date(NOW) });
  const evidence = buildPolicyAuditEvidence({ policy, approvals: gate.list({ limit: 10 }), boundary, validation });
  assert.equal(evidence.ok, true);
  assert.deepEqual(evidence.expectedApprovalActions, ['propose_rate_limit']);
  assert.equal(evidence.boundary.validationOk, true);
  assert.equal(evidence.authorized, false);
  assert.equal(evidence.actionRunnerAvailable, false);
});

test('missing approval and tampered boundary are detected fail-closed', () => {
  const policy = evaluateAiPolicy({ prioritySuggestion: 'P1', requiresHumanReview: false, recommendedActions: ['propose_rate_limit'] });
  const missing = buildPolicyAuditEvidence({ policy, approvals: [] });
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.includes('EXPECTED_APPROVAL_MISSING'));

  const tampered = buildPolicyAuditEvidence({
    policy,
    approvals: [{ approvalId: 'apr_1', action: 'propose_rate_limit', state: 'approved', executable: false }],
    boundary: { approvalId: 'apr_1', action: 'propose_secret_rotation', authorized: false, executable: false, actionRunnerAvailable: false },
    validation: { ok: true, authorized: false, executable: false, actionRunnerAvailable: false }
  });
  assert.equal(tampered.ok, false);
  assert.ok(tampered.issues.includes('BOUNDARY_APPROVAL_MISMATCH'));
});

test('policy audit evidence excludes arbitrary sensitive payloads', () => {
  const policy = evaluateAiPolicy({ prioritySuggestion: 'P1', requiresHumanReview: false, recommendedActions: ['investigate'], rawLog: 'SECRET_RAW' });
  const evidence = buildPolicyAuditEvidence({
    policy: { ...policy, rawLog: 'SECRET_RAW', userId: 'USER_42' },
    approvals: [{ approvalId: 'apr_safe', action: 'investigate', state: 'pending', executable: false, token: 'SECRET_TOKEN' }]
  });
  const text = JSON.stringify(evidence);
  assert.doesNotMatch(text, /SECRET_RAW|USER_42|SECRET_TOKEN/);
  assert.equal(evidence.executable, false);
});

test('orphan validation and executable policy payloads are rejected', () => {
  const evidence = buildPolicyAuditEvidence({
    policy: { decision: 'allow', executable: true, actions: [] },
    approvals: [],
    validation: { ok: true, authorized: false, executable: false, actionRunnerAvailable: false }
  });
  assert.equal(evidence.ok, false);
  assert.ok(evidence.issues.includes('POLICY_EXECUTABLE_INVALID'));
  assert.ok(evidence.issues.includes('ORPHAN_BOUNDARY_VALIDATION'));
});
