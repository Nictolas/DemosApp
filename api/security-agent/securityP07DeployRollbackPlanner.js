const crypto = require('crypto');

const P07_DEPLOY_ROLLBACK_PLANNER_VERSION = 'v0.115';
const P07_ACTION = 'propose_deploy_rollback';

function requireString(value, name, max = 512) {
  if (typeof value !== 'string') throw new Error(`${name}_REQUIRED`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name}_REQUIRED`);
  if (normalized.length > max) throw new Error(`${name}_TOO_LONG`);
  return normalized;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function validateBoundary(boundary, { now, serviceRef }) {
  if (!boundary || typeof boundary !== 'object') throw new Error('P07_BOUNDARY_REQUIRED');
  if (boundary.action !== P07_ACTION) throw new Error('P07_BOUNDARY_ACTION_MISMATCH');
  if (boundary.approvalBound !== true || boundary.singleUse !== true || boundary.dryRunOnly !== true) {
    throw new Error('P07_BOUNDARY_NOT_APPROVAL_BOUND');
  }
  if (boundary.killSwitchEngaged === true) throw new Error('P07_KILL_SWITCH_ENGAGED');
  if (boundary.authorized !== false || boundary.executable !== false || boundary.actionRunnerAvailable !== false) {
    throw new Error('P07_EXECUTION_CAPABILITY_FORBIDDEN');
  }
  if (typeof boundary.bindingHash !== 'string' || !/^[a-f0-9]{64}$/.test(boundary.bindingHash)) {
    throw new Error('P07_BOUNDARY_BINDING_INVALID');
  }
  if (typeof boundary.targetHash !== 'string' || !/^[a-f0-9]{64}$/.test(boundary.targetHash)) {
    throw new Error('P07_BOUNDARY_TARGET_HASH_INVALID');
  }
  const expiresAt = Date.parse(boundary.expiresAt);
  if (!Number.isFinite(expiresAt)) throw new Error('P07_BOUNDARY_EXPIRY_INVALID');
  if (expiresAt <= now.getTime()) throw new Error('P07_BOUNDARY_EXPIRED');
  if (sha256(serviceRef) !== boundary.targetHash) throw new Error('P07_SERVICE_BINDING_MISMATCH');
}

class SecurityP07DeployRollbackPlanner {
  constructor({ now = () => new Date(), maxAudit = 100 } = {}) {
    if (typeof now !== 'function') throw new TypeError('P07_CLOCK_REQUIRED');
    if (!Number.isInteger(maxAudit) || maxAudit < 10 || maxAudit > 1000) throw new Error('P07_AUDIT_LIMIT_INVALID');
    this.now = now;
    this.maxAudit = maxAudit;
    this.killSwitchEngaged = false;
    this.killSwitchReason = null;
    this.usedBoundaries = new Set();
    this.audit = [];
  }

  _time() {
    const value = this.now();
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new Error('P07_CLOCK_INVALID');
    return value;
  }

  _audit(event, details = {}, at = this._time()) {
    const item = Object.freeze({
      at: at.toISOString(),
      event,
      planId: details.planId || null,
      bindingHash: details.bindingHash || null,
      serviceHash: details.serviceHash || null,
      currentDeployHash: details.currentDeployHash || null,
      healthyDeployHash: details.healthyDeployHash || null,
      reasonCode: details.reasonCode || null,
      provider: 'unbound',
      dryRunOnly: true,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false,
      externalWrite: false
    });
    this.audit.unshift(item);
    if (this.audit.length > this.maxAudit) this.audit.length = this.maxAudit;
  }

  plan({ boundary, serviceRef, currentDeployRef, healthyDeployRef } = {}) {
    if (this.killSwitchEngaged) throw new Error('P07_KILL_SWITCH_ENGAGED');
    const at = this._time();
    const service = requireString(serviceRef, 'P07_SERVICE_REF', 512);
    const current = requireString(currentDeployRef, 'P07_CURRENT_DEPLOY_REF', 512);
    const healthy = requireString(healthyDeployRef, 'P07_HEALTHY_DEPLOY_REF', 512);
    if (current === healthy) throw new Error('P07_DEPLOY_TARGET_UNCHANGED');

    validateBoundary(boundary, { now: at, serviceRef: service });
    if (this.usedBoundaries.has(boundary.bindingHash)) throw new Error('P07_BOUNDARY_REPLAY');

    const serviceHash = sha256(service);
    const currentDeployHash = sha256(current);
    const healthyDeployHash = sha256(healthy);
    const planId = `p07_${sha256(JSON.stringify([
      boundary.bindingHash,
      serviceHash,
      currentDeployHash,
      healthyDeployHash
    ])).slice(0, 32)}`;

    const plan = Object.freeze({
      version: P07_DEPLOY_ROLLBACK_PLANNER_VERSION,
      playbookId: 'P07',
      action: P07_ACTION,
      operation: 'rollback_deploy',
      provider: 'unbound',
      planId,
      approvalId: boundary.approvalId || null,
      incidentId: boundary.incidentId || null,
      bindingHash: boundary.bindingHash,
      serviceHash,
      currentDeployHash,
      healthyDeployHash,
      policyVersion: boundary.policyVersion || null,
      createdAt: at.toISOString(),
      boundaryExpiresAt: boundary.expiresAt,
      approvalBound: true,
      singleUseBoundary: true,
      humanApprovalRequired: true,
      dryRunOnly: true,
      reversibleIntent: true,
      externalWrite: false,
      providerAdapterAvailable: false,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });

    this.usedBoundaries.add(boundary.bindingHash);
    this._audit('plan_created', plan, at);
    return plan;
  }

  engageKillSwitch(reason = 'MANUAL') {
    if (!this.killSwitchEngaged) {
      const normalized = requireString(reason, 'P07_KILL_SWITCH_REASON', 96).replace(/[^a-zA-Z0-9:._-]/g, '_');
      this.killSwitchEngaged = true;
      this.killSwitchReason = normalized;
      this._audit('kill_switch_engaged', { reasonCode: normalized });
    }
    return this.status();
  }

  listAudit({ limit = 50 } = {}) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('P07_AUDIT_QUERY_INVALID');
    return Object.freeze(this.audit.slice(0, n));
  }

  status() {
    return Object.freeze({
      version: P07_DEPLOY_ROLLBACK_PLANNER_VERSION,
      playbookId: 'P07',
      action: P07_ACTION,
      mode: 'provider_unbound_dry_run',
      killSwitchEngaged: this.killSwitchEngaged,
      killSwitchReason: this.killSwitchReason,
      usedBoundaryCount: this.usedBoundaries.size,
      provider: 'unbound',
      humanApprovalRequired: true,
      dryRunOnly: true,
      externalWrite: false,
      providerAdapterAvailable: false,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });
  }
}

module.exports = {
  P07_DEPLOY_ROLLBACK_PLANNER_VERSION,
  P07_ACTION,
  SecurityP07DeployRollbackPlanner
};
