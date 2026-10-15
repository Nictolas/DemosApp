const crypto = require('crypto');

const P07_RENDER_DRY_RUN_CONTRACT_VERSION = 'v0.116';
const P07_ACTION = 'propose_deploy_rollback';
const ALLOWED_BINDING_KEYS = new Set(['serviceRef', 'currentDeployRef', 'healthyDeployRef']);

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

function validateHash(value, name) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${name}_INVALID`);
  }
  return value;
}

function validateBindingInput(binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    throw new Error('P07_RENDER_BINDING_REQUIRED');
  }
  for (const key of Object.keys(binding)) {
    if (!ALLOWED_BINDING_KEYS.has(key)) throw new Error('P07_RENDER_BINDING_FIELD_FORBIDDEN');
  }
  return {
    serviceRef: requireString(binding.serviceRef, 'P07_RENDER_SERVICE_REF'),
    currentDeployRef: requireString(binding.currentDeployRef, 'P07_RENDER_CURRENT_DEPLOY_REF'),
    healthyDeployRef: requireString(binding.healthyDeployRef, 'P07_RENDER_HEALTHY_DEPLOY_REF')
  };
}

function validatePlan(plan, now) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('P07_RENDER_PLAN_REQUIRED');
  if (plan.playbookId !== 'P07' || plan.action !== P07_ACTION || plan.operation !== 'rollback_deploy') {
    throw new Error('P07_RENDER_PLAN_KIND_INVALID');
  }
  if (plan.provider !== 'unbound') throw new Error('P07_RENDER_PLAN_PROVIDER_INVALID');
  if (plan.approvalBound !== true || plan.singleUseBoundary !== true || plan.humanApprovalRequired !== true) {
    throw new Error('P07_RENDER_PLAN_APPROVAL_INVALID');
  }
  if (plan.dryRunOnly !== true || plan.externalWrite !== false || plan.providerAdapterAvailable !== false) {
    throw new Error('P07_RENDER_PLAN_DRY_RUN_INVALID');
  }
  if (plan.authorized !== false || plan.executable !== false || plan.actionRunnerAvailable !== false) {
    throw new Error('P07_RENDER_EXECUTION_CAPABILITY_FORBIDDEN');
  }
  validateHash(plan.bindingHash, 'P07_RENDER_BINDING_HASH');
  validateHash(plan.serviceHash, 'P07_RENDER_SERVICE_HASH');
  validateHash(plan.currentDeployHash, 'P07_RENDER_CURRENT_DEPLOY_HASH');
  validateHash(plan.healthyDeployHash, 'P07_RENDER_HEALTHY_DEPLOY_HASH');
  const expiresAt = Date.parse(plan.boundaryExpiresAt);
  if (!Number.isFinite(expiresAt)) throw new Error('P07_RENDER_PLAN_EXPIRY_INVALID');
  if (expiresAt <= now.getTime()) throw new Error('P07_RENDER_PLAN_EXPIRED');
}

class SecurityP07RenderDryRunContract {
  constructor({ now = () => new Date(), maxAudit = 100 } = {}) {
    if (typeof now !== 'function') throw new TypeError('P07_RENDER_CLOCK_REQUIRED');
    if (!Number.isInteger(maxAudit) || maxAudit < 10 || maxAudit > 1000) {
      throw new Error('P07_RENDER_AUDIT_LIMIT_INVALID');
    }
    this.now = now;
    this.maxAudit = maxAudit;
    this.killSwitchEngaged = false;
    this.killSwitchReason = null;
    this.usedBindings = new Set();
    this.audit = [];
  }

  _time() {
    const value = this.now();
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new Error('P07_RENDER_CLOCK_INVALID');
    return value;
  }

  _audit(event, details = {}, at = this._time()) {
    const item = Object.freeze({
      at: at.toISOString(),
      event,
      contractId: details.contractId || null,
      planId: details.planId || null,
      bindingHash: details.bindingHash || null,
      serviceHash: details.serviceHash || null,
      currentDeployHash: details.currentDeployHash || null,
      healthyDeployHash: details.healthyDeployHash || null,
      reasonCode: details.reasonCode || null,
      provider: 'render',
      adapterMode: 'contract_only',
      networkEnabled: false,
      credentialMode: 'none',
      externalWrite: false,
      dryRunOnly: true,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });
    this.audit.unshift(item);
    if (this.audit.length > this.maxAudit) this.audit.length = this.maxAudit;
  }

  bind({ plan, binding } = {}) {
    if (this.killSwitchEngaged) throw new Error('P07_RENDER_KILL_SWITCH_ENGAGED');
    const at = this._time();
    validatePlan(plan, at);
    if (this.usedBindings.has(plan.bindingHash)) throw new Error('P07_RENDER_BINDING_REPLAY');

    const refs = validateBindingInput(binding);
    const serviceHash = sha256(refs.serviceRef);
    const currentDeployHash = sha256(refs.currentDeployRef);
    const healthyDeployHash = sha256(refs.healthyDeployRef);

    if (serviceHash !== plan.serviceHash) throw new Error('P07_RENDER_SERVICE_BINDING_MISMATCH');
    if (currentDeployHash !== plan.currentDeployHash) throw new Error('P07_RENDER_CURRENT_DEPLOY_BINDING_MISMATCH');
    if (healthyDeployHash !== plan.healthyDeployHash) throw new Error('P07_RENDER_HEALTHY_DEPLOY_BINDING_MISMATCH');
    if (currentDeployHash === healthyDeployHash) throw new Error('P07_RENDER_DEPLOY_TARGET_UNCHANGED');

    const contractId = `p07_render_${sha256(JSON.stringify([
      plan.bindingHash,
      plan.planId,
      serviceHash,
      currentDeployHash,
      healthyDeployHash
    ])).slice(0, 32)}`;

    const descriptor = Object.freeze({
      version: P07_RENDER_DRY_RUN_CONTRACT_VERSION,
      playbookId: 'P07',
      action: P07_ACTION,
      operation: 'rollback_deploy',
      provider: 'render',
      adapterMode: 'contract_only',
      contractId,
      sourcePlanId: plan.planId || null,
      approvalId: plan.approvalId || null,
      incidentId: plan.incidentId || null,
      bindingHash: plan.bindingHash,
      serviceHash,
      currentDeployHash,
      healthyDeployHash,
      policyVersion: plan.policyVersion || null,
      createdAt: at.toISOString(),
      expiresAt: plan.boundaryExpiresAt,
      approvalBound: true,
      humanApprovalRequired: true,
      singleUseBinding: true,
      dryRunOnly: true,
      networkEnabled: false,
      credentialMode: 'none',
      providerClientAvailable: false,
      requestMaterialized: false,
      externalWrite: false,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });

    this.usedBindings.add(plan.bindingHash);
    this._audit('render_contract_bound', descriptor, at);
    return descriptor;
  }

  engageKillSwitch(reason = 'MANUAL') {
    if (!this.killSwitchEngaged) {
      const normalized = requireString(reason, 'P07_RENDER_KILL_SWITCH_REASON', 96)
        .replace(/[^a-zA-Z0-9:._-]/g, '_');
      this.killSwitchEngaged = true;
      this.killSwitchReason = normalized;
      this._audit('kill_switch_engaged', { reasonCode: normalized });
    }
    return this.status();
  }

  listAudit({ limit = 50 } = {}) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('P07_RENDER_AUDIT_QUERY_INVALID');
    return Object.freeze(this.audit.slice(0, n));
  }

  status() {
    return Object.freeze({
      version: P07_RENDER_DRY_RUN_CONTRACT_VERSION,
      playbookId: 'P07',
      action: P07_ACTION,
      provider: 'render',
      mode: 'contract_only_dry_run',
      killSwitchEngaged: this.killSwitchEngaged,
      killSwitchReason: this.killSwitchReason,
      usedBindingCount: this.usedBindings.size,
      approvalBound: true,
      humanApprovalRequired: true,
      dryRunOnly: true,
      networkEnabled: false,
      credentialMode: 'none',
      providerClientAvailable: false,
      externalWrite: false,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });
  }
}

module.exports = {
  P07_RENDER_DRY_RUN_CONTRACT_VERSION,
  SecurityP07RenderDryRunContract
};
