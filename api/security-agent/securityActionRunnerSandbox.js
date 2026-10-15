const ACTION_RUNNER_SANDBOX_VERSION = 'v0.110';
const SANDBOX_ACTIONS = Object.freeze(['propose_rate_limit', 'propose_session_revocation']);

function safeToken(value, max = 96) {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, max);
}

function buildActionRunnerSandboxConfig(env = {}) {
  const enabled = env.SECURITY_ACTION_RUNNER_SANDBOX_ENABLED === 'true';
  const blockers = [];
  if (enabled) {
    if (env.SECURITY_AGENT_STAGING_ISOLATION_REQUIRED !== 'true') blockers.push('staging_isolation_not_required');
    if (env.SECURITY_AGENT_ENVIRONMENT_CLASS !== 'staging') blockers.push('environment_class_not_staging');
    if (env.SECURITY_AGENT_RUNTIME_MODE !== 'memory') blockers.push('runtime_not_memory');
    if (env.SECURITY_ACTION_RUNNER_PRODUCTION_WRITE === 'true') blockers.push('production_write_forbidden');
  }
  return Object.freeze({
    version: ACTION_RUNNER_SANDBOX_VERSION,
    enabled,
    ready: enabled && blockers.length === 0,
    environmentClass: env.SECURITY_AGENT_ENVIRONMENT_CLASS || 'unknown',
    runtimeMode: env.SECURITY_AGENT_RUNTIME_MODE || 'unknown',
    productionWriteAllowed: false,
    externalClientsAllowed: false,
    syntheticTargetsOnly: true,
    reversibleOnly: true,
    killSwitchDefaultEngaged: true,
    blockers: Object.freeze([...new Set(blockers)])
  });
}

class SecurityActionRunnerSandbox {
  constructor({ env = {}, now = () => new Date(), maxAudit = 200 } = {}) {
    const config = buildActionRunnerSandboxConfig(env);
    if (!config.ready) {
      const error = new Error('ACTION_RUNNER_SANDBOX_BLOCKED');
      error.code = 'ACTION_RUNNER_SANDBOX_BLOCKED';
      error.blockers = config.blockers;
      throw error;
    }
    if (typeof now !== 'function') throw new TypeError('sandbox clock required');
    if (!Number.isInteger(maxAudit) || maxAudit < 20 || maxAudit > 1000) throw new Error('SANDBOX_AUDIT_LIMIT_INVALID');
    this.config = config;
    this.now = now;
    this.maxAudit = maxAudit;
    this.killSwitchEngaged = true;
    this.authorizationId = null;
    this.sequence = 0;
    this.active = new Map();
    this.audit = [];
  }

  _timestamp() {
    const value = this.now();
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new Error('SANDBOX_CLOCK_INVALID');
    return value;
  }

  _audit(type, details = {}) {
    const at = this._timestamp().toISOString();
    this.audit.unshift(Object.freeze({
      at,
      type,
      action: details.action || null,
      target: details.target || null,
      leaseId: details.leaseId || null,
      reason: details.reason || null,
      productionWrite: false,
      syntheticOnly: true
    }));
    if (this.audit.length > this.maxAudit) this.audit.length = this.maxAudit;
  }

  arm({ authorizationId } = {}) {
    const id = safeToken(authorizationId, 128);
    if (!id) throw new Error('SANDBOX_AUTHORIZATION_REQUIRED');
    this.authorizationId = id;
    this.killSwitchEngaged = false;
    this._audit('armed', { reason: id });
    return this.status();
  }

  _assertExecutable({ approval, action, target, ttlMs }) {
    if (this.killSwitchEngaged) throw new Error('SANDBOX_KILL_SWITCH_ENGAGED');
    if (!this.authorizationId) throw new Error('SANDBOX_AUTHORIZATION_REQUIRED');
    if (!approval || approval.state !== 'approved') throw new Error('SANDBOX_APPROVAL_REQUIRED');
    if (!SANDBOX_ACTIONS.includes(action) || approval.action !== action) throw new Error('SANDBOX_ACTION_NOT_ALLOWED');
    if (!String(target || '').startsWith('synthetic:')) throw new Error('SANDBOX_TARGET_NOT_SYNTHETIC');
    if (!Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > 300000) throw new Error('SANDBOX_TTL_INVALID');
  }

  execute({ approval, action, target, ttlMs = 60000 } = {}) {
    this._assertExecutable({ approval, action, target, ttlMs });
    const now = this._timestamp();
    this.sequence += 1;
    const leaseId = `sandbox_${now.getTime()}_${this.sequence}`;
    const record = {
      leaseId,
      action,
      target: String(target),
      approvalId: safeToken(approval.approvalId || 'approved', 128),
      authorizationId: this.authorizationId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      state: 'active',
      reversible: true,
      productionWrite: false,
      syntheticOnly: true
    };
    this.active.set(leaseId, record);
    this._audit('executed', record);
    return Object.freeze({ ...record });
  }

  rollback(leaseId, reason = 'manual') {
    const id = safeToken(leaseId, 128);
    const record = this.active.get(id);
    if (!record) return Object.freeze({ rolledBack: false, leaseId: id || null, productionWrite: false, syntheticOnly: true });
    this.active.delete(id);
    this._audit('rolled_back', { ...record, reason: safeToken(reason, 96) || 'manual' });
    return Object.freeze({ rolledBack: true, leaseId: id, action: record.action, target: record.target, productionWrite: false, syntheticOnly: true });
  }

  sweepExpired() {
    const nowMs = this._timestamp().getTime();
    let rolledBack = 0;
    for (const [leaseId, record] of [...this.active.entries()]) {
      if (Date.parse(record.expiresAt) <= nowMs) {
        if (this.rollback(leaseId, 'ttl_expired').rolledBack) rolledBack += 1;
      }
    }
    return Object.freeze({ rolledBack, activeLeaseCount: this.active.size, productionWrite: false, syntheticOnly: true });
  }

  engageKillSwitch(reason = 'manual_kill_switch') {
    const ids = [...this.active.keys()];
    let rolledBack = 0;
    for (const leaseId of ids) {
      if (this.rollback(leaseId, 'kill_switch').rolledBack) rolledBack += 1;
    }
    this.killSwitchEngaged = true;
    this.authorizationId = null;
    this._audit('kill_switch_engaged', { reason: safeToken(reason, 96) || 'manual_kill_switch' });
    return Object.freeze({ killSwitchEngaged: true, rolledBack, activeLeaseCount: this.active.size, productionWrite: false, syntheticOnly: true });
  }

  listAudit({ limit = 50 } = {}) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('SANDBOX_AUDIT_QUERY_INVALID');
    return Object.freeze(this.audit.slice(0, n).map(item => Object.freeze({ ...item })));
  }

  status() {
    return Object.freeze({
      version: ACTION_RUNNER_SANDBOX_VERSION,
      mode: 'isolated-synthetic-staging',
      ready: this.config.ready,
      actionRunnerAvailable: true,
      executionEnabled: !this.killSwitchEngaged && Boolean(this.authorizationId),
      killSwitchEngaged: this.killSwitchEngaged,
      activeLeaseCount: this.active.size,
      supportedActions: SANDBOX_ACTIONS,
      syntheticTargetsOnly: true,
      reversibleOnly: true,
      productionWriteAllowed: false,
      externalClientsAllowed: false
    });
  }
}

module.exports = {
  ACTION_RUNNER_SANDBOX_VERSION,
  SANDBOX_ACTIONS,
  buildActionRunnerSandboxConfig,
  SecurityActionRunnerSandbox
};
