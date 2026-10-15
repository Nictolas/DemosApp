const crypto = require('crypto');
const { SecurityApprovalGate } = require('./securityApprovalGate');
const { buildExecutionBoundary } = require('./securityExecutionBoundary');

const L3_APPROVAL_CONTROL_PLANE_VERSION = 'v0.114';

function requireString(value, name, max = 512) {
  if (typeof value !== 'string') throw new Error(`${name}_REQUIRED`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name}_REQUIRED`);
  if (normalized.length > max) throw new Error(`${name}_TOO_LONG`);
  return normalized;
}

function safeToken(value, name, max = 96) {
  const normalized = requireString(value, name, max);
  const safe = normalized.replace(/[^a-zA-Z0-9:._-]/g, '_').slice(0, max);
  if (!safe) throw new Error(`${name}_INVALID`);
  return safe;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function bindingHash({ incidentId, action, targetHash, policyVersion }) {
  return sha256(JSON.stringify([incidentId, action, targetHash, policyVersion]));
}

class SecurityL3ApprovalControlPlane {
  constructor({
    now = () => new Date(),
    ttlMs = 10 * 60 * 1000,
    boundaryTtlMs = 5 * 60 * 1000,
    maxRecords = 100,
    maxAudit = 200
  } = {}) {
    if (typeof now !== 'function') throw new TypeError('L3_APPROVAL_CLOCK_REQUIRED');
    if (!Number.isInteger(boundaryTtlMs) || boundaryTtlMs < 60000 || boundaryTtlMs > 900000) {
      throw new Error('L3_BOUNDARY_TTL_INVALID');
    }
    if (!Number.isInteger(maxAudit) || maxAudit < 10 || maxAudit > 1000) {
      throw new Error('L3_AUDIT_LIMIT_INVALID');
    }
    this.now = now;
    this.boundaryTtlMs = boundaryTtlMs;
    this.maxAudit = maxAudit;
    this.gate = new SecurityApprovalGate({ now, ttlMs, maxRecords });
    this.records = new Map();
    this.audit = [];
    this.killSwitchEngaged = false;
    this.killSwitchReason = null;
  }

  _time() {
    const at = this.now();
    if (!(at instanceof Date) || Number.isNaN(at.getTime())) throw new Error('L3_APPROVAL_CLOCK_INVALID');
    return at;
  }

  _audit(event, record = null, extra = {}, at = this._time()) {
    const item = Object.freeze({
      at: at.toISOString(),
      event,
      approvalId: record?.approvalId ?? null,
      incidentId: record?.incidentId ?? null,
      action: record?.action ?? null,
      targetHash: record?.targetHash ?? null,
      policyVersion: record?.policyVersion ?? null,
      bindingHash: record?.bindingHash ?? null,
      state: record?.state ?? null,
      actorHash: extra.actorHash ?? null,
      reasonCode: extra.reasonCode ?? null,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false,
      dryRunOnly: true
    });
    this.audit.unshift(item);
    if (this.audit.length > this.maxAudit) this.audit.length = this.maxAudit;
  }

  _record(approvalId) {
    const id = safeToken(approvalId, 'L3_APPROVAL_ID', 128);
    const record = this.records.get(id);
    if (!record) throw new Error('L3_APPROVAL_NOT_FOUND');
    return record;
  }

  request({ incidentId, action, targetRef, policyVersion, priority = 'P2' } = {}) {
    if (this.killSwitchEngaged) throw new Error('L3_KILL_SWITCH_ENGAGED');
    const safeIncidentId = safeToken(incidentId, 'L3_INCIDENT_ID', 96);
    const safePolicyVersion = safeToken(policyVersion, 'L3_POLICY_VERSION', 96);
    const normalizedTarget = requireString(targetRef, 'L3_TARGET_REF', 512);
    const pending = this.gate.request({ action, reasonCode: 'L3_HUMAN_APPROVAL_REQUIRED', priority });
    const targetHash = sha256(normalizedTarget);
    const digest = bindingHash({
      incidentId: safeIncidentId,
      action: pending.action,
      targetHash,
      policyVersion: safePolicyVersion
    });
    const record = {
      approvalId: pending.approvalId,
      incidentId: safeIncidentId,
      action: pending.action,
      targetHash,
      policyVersion: safePolicyVersion,
      bindingHash: digest,
      priority: pending.priority,
      state: 'pending',
      requestedAt: pending.requestedAt,
      expiresAt: pending.expiresAt,
      decidedAt: null,
      consumedAt: null,
      actorHash: null
    };
    this.records.set(record.approvalId, record);
    this._audit('requested', record);
    return Object.freeze({ ...record, authorized: false, executable: false, actionRunnerAvailable: false, dryRunOnly: true });
  }

  decide(approvalId, decision, { actorRef, source } = {}) {
    if (this.killSwitchEngaged) throw new Error('L3_KILL_SWITCH_ENGAGED');
    if (source !== 'human') throw new Error('L3_HUMAN_DECISION_REQUIRED');
    const normalizedActor = requireString(actorRef, 'L3_ACTOR_REF', 256);
    const record = this._record(approvalId);
    const decided = this.gate.decide(record.approvalId, decision);
    record.state = decided.state;
    record.decidedAt = decided.decidedAt;
    record.actorHash = sha256(normalizedActor);
    this._audit(decision, record, { actorHash: record.actorHash });
    return Object.freeze({ ...record, authorized: false, executable: false, actionRunnerAvailable: false, dryRunOnly: true });
  }

  issueDryRunBoundary(approvalId, { incidentId, action, targetRef, policyVersion } = {}) {
    if (this.killSwitchEngaged) throw new Error('L3_KILL_SWITCH_ENGAGED');
    const record = this._record(approvalId);
    const at = this._time();
    if (Date.parse(record.expiresAt) <= at.getTime()) {
      if (record.state !== 'expired' && record.state !== 'consumed') {
        record.state = 'expired';
        this._audit('expired', record, {}, at);
      }
      throw new Error('L3_APPROVAL_EXPIRED');
    }
    if (record.state === 'consumed' || record.consumedAt) throw new Error('L3_APPROVAL_REPLAY');
    if (record.state !== 'approved') throw new Error('L3_APPROVAL_NOT_APPROVED');

    const safeIncidentId = safeToken(incidentId, 'L3_INCIDENT_ID', 96);
    const safePolicyVersion = safeToken(policyVersion, 'L3_POLICY_VERSION', 96);
    const normalizedAction = safeToken(action, 'L3_ACTION', 96);
    const targetHash = sha256(requireString(targetRef, 'L3_TARGET_REF', 512));
    const suppliedBinding = bindingHash({
      incidentId: safeIncidentId,
      action: normalizedAction,
      targetHash,
      policyVersion: safePolicyVersion
    });
    if (suppliedBinding !== record.bindingHash) {
      this._audit('binding_mismatch', record, {}, at);
      throw new Error('L3_BINDING_MISMATCH');
    }

    const boundary = buildExecutionBoundary({
      approvalId: record.approvalId,
      action: record.action,
      priority: record.priority,
      state: 'approved'
    }, { now: () => new Date(at), ttlMs: this.boundaryTtlMs });

    record.state = 'consumed';
    record.consumedAt = at.toISOString();
    this._audit('consumed_dry_run', record, {}, at);
    return Object.freeze({
      ...boundary,
      bindingHash: record.bindingHash,
      incidentId: record.incidentId,
      targetHash: record.targetHash,
      policyVersion: record.policyVersion,
      approvalBound: true,
      singleUse: true,
      dryRunOnly: true,
      killSwitchEngaged: false,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false
    });
  }

  engageKillSwitch(reason = 'MANUAL') {
    if (!this.killSwitchEngaged) {
      this.killSwitchEngaged = true;
      this.killSwitchReason = safeToken(reason, 'L3_KILL_SWITCH_REASON', 96);
      this._audit('kill_switch_engaged', null, { reasonCode: this.killSwitchReason });
    }
    return this.status();
  }

  listAudit({ limit = 50 } = {}) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 200) throw new Error('L3_AUDIT_LIMIT_QUERY_INVALID');
    return Object.freeze(this.audit.slice(0, n));
  }

  status() {
    return Object.freeze({
      version: L3_APPROVAL_CONTROL_PLANE_VERSION,
      mode: 'shadow_pre_gate',
      recordCount: this.records.size,
      auditCount: this.audit.length,
      killSwitchEngaged: this.killSwitchEngaged,
      killSwitchReason: this.killSwitchReason,
      approvalGate: this.gate.status(),
      humanApprovalRequired: true,
      approvalBound: true,
      singleUse: true,
      dryRunOnly: true,
      authorized: false,
      executable: false,
      actionRunnerAvailable: false,
      productionAdaptersAvailable: false
    });
  }
}

module.exports = {
  L3_APPROVAL_CONTROL_PLANE_VERSION,
  SecurityL3ApprovalControlPlane
};
