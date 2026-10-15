const { POLICY_DECISIONS, RECOMMENDED_ACTIONS, APPROVAL_ACTIONS, resolveApprovalAction } = require('./securityActionCatalog');

const POLICY_AUDIT_EVIDENCE_VERSION = 'v0.84';
const APPROVAL_STATES = new Set(['pending', 'approved', 'rejected', 'expired']);

function safeToken(value, max = 96) {
  return String(value ?? '').trim().replace(/[^A-Za-z0-9_.:\-]/g, '_').slice(0, max);
}

function unique(values) {
  return [...new Set(values)];
}

function buildPolicyAuditEvidence({ policy = {}, approvals = [], boundary = null, validation = null } = {}) {
  const issues = [];
  const decision = POLICY_DECISIONS.includes(policy?.decision) ? policy.decision : null;
  if (!decision) issues.push('POLICY_DECISION_INVALID');
  if (policy?.executable !== false) issues.push('POLICY_EXECUTABLE_INVALID');

  const rawActions = Array.isArray(policy?.actions) ? policy.actions.slice(0, 10) : [];
  const policyActions = [];
  const expectedApprovalActions = [];
  for (const item of rawActions) {
    const action = safeToken(item?.action, 64);
    const actionDecision = POLICY_DECISIONS.includes(item?.decision) ? item.decision : null;
    if (!RECOMMENDED_ACTIONS.includes(action)) issues.push('POLICY_ACTION_INVALID');
    if (!actionDecision) issues.push('POLICY_ACTION_DECISION_INVALID');
    if (item?.executable !== false) issues.push('POLICY_ACTION_EXECUTABLE_INVALID');
    if (RECOMMENDED_ACTIONS.includes(action) && actionDecision) {
      policyActions.push(Object.freeze({ action, decision: actionDecision, executable: false }));
      const approvalAction = resolveApprovalAction(action, actionDecision);
      if (approvalAction) expectedApprovalActions.push(approvalAction);
    }
  }

  const approvalItems = [];
  for (const item of (Array.isArray(approvals) ? approvals : []).slice(0, 20)) {
    const action = safeToken(item?.action, 64);
    const approvalId = safeToken(item?.approvalId, 96);
    const state = safeToken(item?.state, 16);
    if (!APPROVAL_ACTIONS.includes(action)) issues.push('APPROVAL_ACTION_INVALID');
    if (!approvalId) issues.push('APPROVAL_ID_MISSING');
    if (!APPROVAL_STATES.has(state)) issues.push('APPROVAL_STATE_INVALID');
    if (item?.executable !== false) issues.push('APPROVAL_EXECUTABLE_INVALID');
    approvalItems.push(Object.freeze({ approvalId, action, state, executable: false }));
  }

  const expected = unique(expectedApprovalActions);
  const actual = unique(approvalItems.map(item => item.action));
  for (const action of expected) if (!actual.includes(action)) issues.push('EXPECTED_APPROVAL_MISSING');
  for (const action of actual) if (!expected.includes(action)) issues.push('UNEXPECTED_APPROVAL_ACTION');

  let boundarySummary = null;
  if (boundary !== null && boundary !== undefined) {
    const action = safeToken(boundary?.action, 64);
    const approvalId = safeToken(boundary?.approvalId, 96);
    if (!APPROVAL_ACTIONS.includes(action)) issues.push('BOUNDARY_ACTION_INVALID');
    if (boundary?.authorized !== false) issues.push('BOUNDARY_AUTHORIZED_INVALID');
    if (boundary?.executable !== false) issues.push('BOUNDARY_EXECUTABLE_INVALID');
    if (boundary?.actionRunnerAvailable !== false) issues.push('BOUNDARY_RUNNER_INVALID');
    const matchingApproval = approvalItems.find(item => item.approvalId === approvalId && item.action === action && item.state === 'approved');
    if (!matchingApproval) issues.push('BOUNDARY_APPROVAL_MISMATCH');
    if (!validation || validation.ok !== true) issues.push('BOUNDARY_VALIDATION_FAILED');
    if (validation && (validation.authorized !== false || validation.executable !== false || validation.actionRunnerAvailable !== false)) issues.push('BOUNDARY_VALIDATION_CAPABILITY_INVALID');
    boundarySummary = Object.freeze({ approvalId, action, validationOk: validation?.ok === true, authorized: false, executable: false, actionRunnerAvailable: false });
  } else if (validation !== null && validation !== undefined) {
    issues.push('ORPHAN_BOUNDARY_VALIDATION');
  }

  const cleanIssues = unique(issues);
  return Object.freeze({
    version: POLICY_AUDIT_EVIDENCE_VERSION,
    ok: cleanIssues.length === 0,
    issueCount: cleanIssues.length,
    issues: Object.freeze(cleanIssues),
    policyDecision: decision || 'deny',
    policyActions: Object.freeze(policyActions),
    expectedApprovalActions: Object.freeze(expected),
    approvals: Object.freeze(approvalItems),
    boundary: boundarySummary,
    authorized: false,
    executable: false,
    actionRunnerAvailable: false
  });
}

module.exports = { POLICY_AUDIT_EVIDENCE_VERSION, buildPolicyAuditEvidence };
