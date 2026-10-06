const { BOUNDARY_ACTIONS } = require('./securityActionCatalog');
const { EXECUTION_BOUNDARY_VERSION } = require('./securityExecutionBoundary');

const EXECUTION_BOUNDARY_VALIDATION_VERSION = 'v0.34';
const ACTIONS = new Set(BOUNDARY_ACTIONS);

function validateExecutionBoundary(boundary = {}, { now = () => new Date() } = {}) {
  const issues = [];
  const at = now();
  if (!boundary || typeof boundary !== 'object' || Array.isArray(boundary)) issues.push('BOUNDARY_INVALID');
  else {
    if (boundary.version !== EXECUTION_BOUNDARY_VERSION) issues.push('VERSION_INVALID');
    if (!ACTIONS.has(boundary.action)) issues.push('ACTION_INVALID');
    if (!boundary.approvalId) issues.push('APPROVAL_ID_MISSING');
    if (boundary.authorized !== false) issues.push('AUTHORIZED_MUST_BE_FALSE');
    if (boundary.executable !== false) issues.push('EXECUTABLE_MUST_BE_FALSE');
    if (boundary.actionRunnerAvailable !== false) issues.push('RUNNER_MUST_BE_FALSE');
    const exp = Date.parse(boundary.expiresAt);
    if (!Number.isFinite(exp) || !(at instanceof Date) || Number.isNaN(at.getTime()) || exp <= at.getTime()) issues.push('BOUNDARY_EXPIRED');
  }
  return Object.freeze({
    version: EXECUTION_BOUNDARY_VALIDATION_VERSION,
    ok: issues.length === 0,
    issueCount: new Set(issues).size,
    issues: Object.freeze([...new Set(issues)]),
    authorized: false,
    executable: false,
    actionRunnerAvailable: false
  });
}

function boundaryValidationStatus() {
  return Object.freeze({ version: EXECUTION_BOUNDARY_VALIDATION_VERSION, mode: 'shadow', authorized: false, executable: false, actionRunnerAvailable: false });
}

module.exports = { EXECUTION_BOUNDARY_VALIDATION_VERSION, validateExecutionBoundary, boundaryValidationStatus };
