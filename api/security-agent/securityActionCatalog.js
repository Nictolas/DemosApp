const ACTION_CATALOG_VERSION = 'v0.83';
const POLICY_DECISIONS = Object.freeze(['allow', 'deny', 'escalate']);

const ACTION_CATALOG = Object.freeze({
  observe: Object.freeze({ policyDecision: 'allow', approvalEligible: false, boundaryEligible: false, effectClass: 'read_only' }),
  investigate: Object.freeze({ policyDecision: 'escalate', approvalEligible: true, boundaryEligible: true, effectClass: 'human_review' }),
  escalate_human: Object.freeze({ policyDecision: 'escalate', approvalEligible: true, boundaryEligible: true, effectClass: 'human_review' }),
  propose_rate_limit: Object.freeze({ policyDecision: 'escalate', approvalEligible: true, boundaryEligible: true, effectClass: 'proposal_only' }),
  propose_session_revocation: Object.freeze({ policyDecision: 'escalate', approvalEligible: true, boundaryEligible: true, effectClass: 'proposal_only' }),
  propose_endpoint_isolation: Object.freeze({ policyDecision: 'escalate', approvalEligible: true, boundaryEligible: true, effectClass: 'proposal_only' }),
  propose_secret_rotation: Object.freeze({ policyDecision: 'escalate', approvalEligible: true, boundaryEligible: true, effectClass: 'proposal_only' })
});

const RECOMMENDED_ACTIONS = Object.freeze(Object.keys(ACTION_CATALOG));
const APPROVAL_ACTIONS = Object.freeze(RECOMMENDED_ACTIONS.filter(action => ACTION_CATALOG[action].approvalEligible));
const BOUNDARY_ACTIONS = Object.freeze(RECOMMENDED_ACTIONS.filter(action => ACTION_CATALOG[action].boundaryEligible));

function validateActionCatalog() {
  const issues = [];
  if (RECOMMENDED_ACTIONS.length === 0) issues.push('CATALOG_EMPTY');
  for (const action of RECOMMENDED_ACTIONS) {
    const entry = ACTION_CATALOG[action];
    if (!entry || typeof entry !== 'object') { issues.push('ENTRY_INVALID'); continue; }
    if (!POLICY_DECISIONS.includes(entry.policyDecision)) issues.push('DECISION_INVALID');
    if (typeof entry.approvalEligible !== 'boolean') issues.push('APPROVAL_FLAG_INVALID');
    if (typeof entry.boundaryEligible !== 'boolean') issues.push('BOUNDARY_FLAG_INVALID');
    if (!['read_only', 'human_review', 'proposal_only'].includes(entry.effectClass)) issues.push('EFFECT_CLASS_INVALID');
    if (entry.approvalEligible !== entry.boundaryEligible) issues.push('APPROVAL_BOUNDARY_DRIFT');
    if (action === 'observe') {
      if (entry.policyDecision !== 'allow' || entry.approvalEligible || entry.boundaryEligible || entry.effectClass !== 'read_only') issues.push('OBSERVE_POLICY_INVALID');
    } else if (entry.policyDecision !== 'escalate' || !entry.approvalEligible || !entry.boundaryEligible) {
      issues.push('ACTION_POLICY_INVALID');
    }
  }
  if (new Set(RECOMMENDED_ACTIONS).size !== RECOMMENDED_ACTIONS.length) issues.push('DUPLICATE_ACTION');
  return Object.freeze({
    version: ACTION_CATALOG_VERSION,
    ok: issues.length === 0,
    issueCount: new Set(issues).size,
    issues: Object.freeze([...new Set(issues)]),
    actionCount: RECOMMENDED_ACTIONS.length,
    approvalActionCount: APPROVAL_ACTIONS.length,
    boundaryActionCount: BOUNDARY_ACTIONS.length,
    defaultUnknownDecision: 'deny',
    executable: false,
    actionRunnerAvailable: false
  });
}

function actionCatalogStatus() {
  const validation = validateActionCatalog();
  return Object.freeze({
    version: ACTION_CATALOG_VERSION,
    mode: 'shadow',
    ok: validation.ok,
    actionCount: validation.actionCount,
    approvalActionCount: validation.approvalActionCount,
    boundaryActionCount: validation.boundaryActionCount,
    defaultUnknownDecision: 'deny',
    executable: false,
    actionRunnerAvailable: false
  });
}

module.exports = {
  ACTION_CATALOG_VERSION,
  POLICY_DECISIONS,
  ACTION_CATALOG,
  RECOMMENDED_ACTIONS,
  APPROVAL_ACTIONS,
  BOUNDARY_ACTIONS,
  validateActionCatalog,
  actionCatalogStatus
};
