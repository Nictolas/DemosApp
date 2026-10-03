const { RECOMMENDED_ACTIONS } = require('./securityAiAnalystContract');

const POLICY_ENGINE_VERSION = 'v0.21';
const POLICY_DECISIONS = Object.freeze(['allow', 'deny', 'escalate']);

const ACTION_POLICY = Object.freeze({
  observe: 'allow',
  investigate: 'escalate',
  escalate_human: 'escalate',
  propose_rate_limit: 'escalate',
  propose_session_revocation: 'escalate',
  propose_endpoint_isolation: 'escalate',
  propose_secret_rotation: 'escalate'
});

function safePriority(value) {
  return ['P0', 'P1', 'P2', 'P3'].includes(value) ? value : null;
}

function evaluateActionPolicy(action, { priority = 'P3', requiresHumanReview = false } = {}) {
  const normalized = typeof action === 'string' ? action : '';
  if (!RECOMMENDED_ACTIONS.includes(normalized) || !Object.prototype.hasOwnProperty.call(ACTION_POLICY, normalized)) {
    return Object.freeze({ action: 'unknown', decision: 'deny', reasonCode: 'ACTION_NOT_ALLOWLISTED', executable: false });
  }

  const safe = safePriority(priority);
  if (!safe) {
    return Object.freeze({ action: normalized, decision: 'deny', reasonCode: 'PRIORITY_INVALID', executable: false });
  }

  let decision = ACTION_POLICY[normalized];
  let reasonCode = decision === 'allow' ? 'READ_ONLY_OBSERVATION' : 'HUMAN_APPROVAL_REQUIRED';

  if (requiresHumanReview === true || safe === 'P0') {
    decision = 'escalate';
    reasonCode = requiresHumanReview === true ? 'MODEL_REQUIRES_HUMAN_REVIEW' : 'P0_REQUIRES_HUMAN_REVIEW';
  }

  return Object.freeze({ action: normalized, decision, reasonCode, executable: false });
}

function evaluateAiPolicy(analysis = {}) {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
    return Object.freeze({
      version: POLICY_ENGINE_VERSION,
      mode: 'shadow',
      decision: 'deny',
      reasonCode: 'ANALYSIS_INVALID',
      executable: false,
      actions: Object.freeze([])
    });
  }

  const priority = safePriority(analysis.prioritySuggestion);
  const actions = Array.isArray(analysis.recommendedActions) ? analysis.recommendedActions.slice(0, 5) : [];
  if (!priority) {
    return Object.freeze({
      version: POLICY_ENGINE_VERSION,
      mode: 'shadow',
      decision: 'deny',
      reasonCode: 'PRIORITY_INVALID',
      executable: false,
      actions: Object.freeze(actions.map(action => evaluateActionPolicy(action, { priority: 'invalid' })))
    });
  }

  const evaluated = Object.freeze(actions.map(action => evaluateActionPolicy(action, {
    priority,
    requiresHumanReview: analysis.requiresHumanReview === true
  })));

  const decisions = evaluated.map(item => item.decision);
  const decision = decisions.includes('deny') ? 'deny' : (decisions.includes('escalate') ? 'escalate' : 'allow');

  return Object.freeze({
    version: POLICY_ENGINE_VERSION,
    mode: 'shadow',
    decision,
    reasonCode: decision === 'allow' ? 'READ_ONLY_ONLY' : (decision === 'escalate' ? 'HUMAN_APPROVAL_REQUIRED' : 'POLICY_DENIED'),
    executable: false,
    actions: evaluated
  });
}

function policyStatus() {
  return Object.freeze({
    version: POLICY_ENGINE_VERSION,
    mode: 'shadow',
    executable: false,
    actionRunnerAvailable: false,
    defaultUnknownDecision: 'deny',
    decisions: POLICY_DECISIONS,
    actionCount: Object.keys(ACTION_POLICY).length
  });
}

module.exports = {
  POLICY_ENGINE_VERSION,
  POLICY_DECISIONS,
  ACTION_POLICY,
  evaluateActionPolicy,
  evaluateAiPolicy,
  policyStatus
};
