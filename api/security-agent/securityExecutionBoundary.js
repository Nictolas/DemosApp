const { BOUNDARY_ACTIONS } = require('./securityActionCatalog');

const EXECUTION_BOUNDARY_VERSION = 'v0.33';
const ALLOWED_ACTIONS = new Set(BOUNDARY_ACTIONS);

function safe(value, max = 96) {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, max);
}

function buildExecutionBoundary(approval = {}, { now = () => new Date(), ttlMs = 5 * 60 * 1000 } = {}) {
  if (!approval || approval.state !== 'approved') throw new Error('BOUNDARY_APPROVAL_REQUIRED');
  if (!ALLOWED_ACTIONS.has(approval.action)) throw new Error('BOUNDARY_ACTION_NOT_ALLOWED');
  const issued = now();
  if (!(issued instanceof Date) || Number.isNaN(issued.getTime())) throw new Error('BOUNDARY_CLOCK_INVALID');
  if (!Number.isInteger(ttlMs) || ttlMs < 60000 || ttlMs > 900000) throw new Error('BOUNDARY_TTL_INVALID');
  const approvalId = safe(approval.approvalId);
  if (!approvalId) throw new Error('BOUNDARY_APPROVAL_ID_REQUIRED');
  return Object.freeze({
    version: EXECUTION_BOUNDARY_VERSION,
    approvalId,
    action: approval.action,
    priority: ['P0', 'P1', 'P2', 'P3'].includes(approval.priority) ? approval.priority : 'P3',
    issuedAt: issued.toISOString(),
    expiresAt: new Date(issued.getTime() + ttlMs).toISOString(),
    idempotencyKey: safe(`boundary:${approvalId}:${approval.action}`, 128),
    policyVersion: 'shadow',
    authorized: false,
    executable: false,
    actionRunnerAvailable: false
  });
}

module.exports = { EXECUTION_BOUNDARY_VERSION, buildExecutionBoundary };
