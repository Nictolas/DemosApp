const crypto = require('crypto');

const P07_RENDER_BINDING_VERSION = 'v0.116';
const FORBIDDEN_KEYS = new Set([
  'credential', 'credentials', 'client', 'fetch', 'baseurl', 'header', 'headers',
  'token', 'apikey', 'api_key', 'authorization', 'password', 'secret'
]);

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

function rejectForbiddenKeys(value, path = 'payload', seen = new Set()) {
  if (value == null || typeof value !== 'object') return;
  if (seen.has(value)) throw new Error('P07_RENDER_PAYLOAD_CYCLE_FORBIDDEN');
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (FORBIDDEN_KEYS.has(normalized)) {
      throw new Error(`P07_RENDER_FORBIDDEN_FIELD:${path}.${key}`);
    }
    rejectForbiddenKeys(child, `${path}.${key}`, seen);
  }
  seen.delete(value);
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('P07_RENDER_PLAN_REQUIRED');
  if (plan.playbookId !== 'P07' || plan.action !== 'propose_deploy_rollback') {
    throw new Error('P07_RENDER_PLAN_ACTION_INVALID');
  }
  if (plan.operation !== 'rollback_deploy' || plan.provider !== 'unbound') {
    throw new Error('P07_RENDER_PLAN_PROVIDER_STATE_INVALID');
  }
  if (plan.approvalBound !== true || plan.singleUseBoundary !== true || plan.humanApprovalRequired !== true || plan.dryRunOnly !== true) {
    throw new Error('P07_RENDER_PLAN_NOT_APPROVAL_BOUND');
  }
  if (plan.externalWrite !== false || plan.providerAdapterAvailable !== false || plan.authorized !== false || plan.executable !== false || plan.actionRunnerAvailable !== false) {
    throw new Error('P07_RENDER_PLAN_EXECUTION_CAPABILITY_FORBIDDEN');
  }
  for (const field of ['serviceHash', 'currentDeployHash', 'healthyDeployHash', 'bindingHash']) {
    if (typeof plan[field] !== 'string' || !/^[a-f0-9]{64}$/.test(plan[field])) {
      throw new Error(`P07_RENDER_${field.toUpperCase()}_INVALID`);
    }
  }
  if (typeof plan.planId !== 'string' || !/^p07_[a-f0-9]{32}$/.test(plan.planId)) {
    throw new Error('P07_RENDER_PLAN_ID_INVALID');
  }
}

class SecurityP07RenderBindingContract {
  constructor({ now = () => new Date(), maxAudit = 100 } = {}) {
    if (typeof now !== 'function') throw new TypeError('P07_RENDER_CLOCK_REQUIRED');
    if (!Number.isInteger(maxAudit) || maxAudit < 10 || maxAudit > 1000) throw new Error('P07_RENDER_AUDIT_LIMIT_INVALID');
    this.now = now;
    this.maxAudit = maxAudit;
    this.killSwitchEngaged = false;
    this.killSwitchReason = null;
    this.consumedBindings = new Set();
    this.audit = [];
  }

  _time() {
    const at = this.now();
    if (!(at instanceof Date) || Number.isNaN(at.getTime())) throw new Error('P07_RENDER_CLOCK_INVALID');
    return at;
  }

  _audit(event, details = {}, at = this._time()) {
    const item = Object.freeze({
      at: at.toISOString(),
      event,
      descriptorId: details.descriptorId || null,
      planId: details.planId || null,
      bindingHash: details.bindingHash || null,
      serviceHash: details.serviceHash || null,
      currentDeployHash: details.currentDeployHash || null,
      healthyDeployHash: details.healthyDeployHash || null,
      reasonCode: details.reasonCode || null,
      provider: 'render',
      networkEnabled: false,
      transportEnabled: false,
      externalWrite: false,
      dryRunOnly: true,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });
    this.audit.unshift(item);
    if (this.audit.length > this.maxAudit) this.audit.length = this.maxAudit;
  }

  bind(payload = {}) {
    if (this.killSwitchEngaged) throw new Error('P07_RENDER_KILL_SWITCH_ENGAGED');
    rejectForbiddenKeys(payload);

    const { plan } = payload;
    validatePlan(plan);
    const serviceRef = requireString(payload.serviceRef, 'P07_RENDER_SERVICE_REF', 512);
    const currentDeployRef = requireString(payload.currentDeployRef, 'P07_RENDER_CURRENT_DEPLOY_REF', 512);
    const healthyDeployRef = requireString(payload.healthyDeployRef, 'P07_RENDER_HEALTHY_DEPLOY_REF', 512);

    if (sha256(serviceRef) !== plan.serviceHash) throw new Error('P07_RENDER_SERVICE_HASH_MISMATCH');
    if (sha256(currentDeployRef) !== plan.currentDeployHash) throw new Error('P07_RENDER_CURRENT_DEPLOY_HASH_MISMATCH');
    if (sha256(healthyDeployRef) !== plan.healthyDeployHash) throw new Error('P07_RENDER_HEALTHY_DEPLOY_HASH_MISMATCH');

    const bindingKey = sha256(`${plan.planId}:${plan.bindingHash}:render`);
    if (this.consumedBindings.has(bindingKey)) throw new Error('P07_RENDER_BINDING_REPLAY');

    const at = this._time();
    const descriptorId = `p07_render_${bindingKey.slice(0, 32)}`;
    const descriptor = Object.freeze({
      version: P07_RENDER_BINDING_VERSION,
      descriptorId,
      playbookId: 'P07',
      action: 'propose_deploy_rollback',
      operation: 'rollback_deploy',
      provider: 'render',
      providerBindingMode: 'offline_descriptor',
      planId: plan.planId,
      bindingHash: plan.bindingHash,
      serviceHash: plan.serviceHash,
      currentDeployHash: plan.currentDeployHash,
      healthyDeployHash: plan.healthyDeployHash,
      createdAt: at.toISOString(),
      humanApprovalRequired: true,
      approvalBound: true,
      singleUseBinding: true,
      dryRunOnly: true,
      networkEnabled: false,
      transportEnabled: false,
      externalWrite: false,
      credentialFieldsAccepted: false,
      providerClientAvailable: false,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });

    this.consumedBindings.add(bindingKey);
    this._audit('render_binding_created', descriptor, at);
    return descriptor;
  }

  engageKillSwitch(reason = 'MANUAL') {
    if (!this.killSwitchEngaged) {
      const safeReason = requireString(reason, 'P07_RENDER_KILL_SWITCH_REASON', 96).replace(/[^a-zA-Z0-9:._-]/g, '_');
      this.killSwitchEngaged = true;
      this.killSwitchReason = safeReason;
      this._audit('kill_switch_engaged', { reasonCode: safeReason });
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
      version: P07_RENDER_BINDING_VERSION,
      provider: 'render',
      mode: 'offline_descriptor',
      killSwitchEngaged: this.killSwitchEngaged,
      killSwitchReason: this.killSwitchReason,
      consumedBindingCount: this.consumedBindings.size,
      humanApprovalRequired: true,
      approvalBound: true,
      dryRunOnly: true,
      networkEnabled: false,
      transportEnabled: false,
      externalWrite: false,
      credentialFieldsAccepted: false,
      providerClientAvailable: false,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });
  }
}

module.exports = {
  P07_RENDER_BINDING_VERSION,
  SecurityP07RenderBindingContract
};
