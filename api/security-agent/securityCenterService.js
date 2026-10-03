const { buildSecurityCenterOverview, pickIncident } = require('./securityCenterReadModel');
const { emptyNotificationSimulationStatus } = require('./securityNotificationSimulation');
const { emptyAiAnalystMockStatus } = require('./securityAiAnalystMockRunner');
const { policyStatus } = require('./securityPolicyEngine');

const ALLOWED_STATUSES = new Set(['open', 'acknowledged', 'resolved']);
const ALLOWED_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);

function validateOptionalFilter(value, allowed, name) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).toLowerCase();
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}`);
  return normalized;
}

function validateLimit(value, fallback = 100) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) throw new Error('invalid limit');
  return parsed;
}

class SecurityCenterService {
  constructor({ runner, runtime = null, store, notificationSimulation = null, aiAnalyst = null, aiOrchestrator = null, aiPolicy = null, approvalGate = null, sourceName = 'axiom-security', staleAfterMs = 10 * 60 * 1000 } = {}) {
    if (!runner || typeof runner.status !== 'function') throw new TypeError('runner.status() is required');
    if (runtime !== null && (!runtime || typeof runtime.status !== 'function')) throw new TypeError('runtime.status() is required when runtime is provided');
    if (!store || typeof store.listIncidents !== 'function' || typeof store.stats !== 'function' || typeof store.getSourceState !== 'function') throw new TypeError('store read contract is required');
    if (notificationSimulation !== null && (!notificationSimulation || typeof notificationSimulation.status !== 'function' || typeof notificationSimulation.listAudit !== 'function')) throw new TypeError('notification simulation read contract is required when provided');
    if (aiAnalyst !== null && (!aiAnalyst || typeof aiAnalyst.status !== 'function' || typeof aiAnalyst.listRecent !== 'function')) throw new TypeError('AI analyst read contract is required when provided');
    if (aiOrchestrator !== null && (!aiOrchestrator || typeof aiOrchestrator.status !== 'function' || typeof aiOrchestrator.listDecisions !== 'function')) throw new TypeError('AI orchestrator read contract is required when provided');
    if (aiPolicy !== null && (!aiPolicy || typeof aiPolicy.status !== 'function' || typeof aiPolicy.listRecent !== 'function')) throw new TypeError('AI policy read contract is required when provided');
    if (approvalGate !== null && (!approvalGate || typeof approvalGate.status !== 'function' || typeof approvalGate.list !== 'function' || typeof approvalGate.listAudit !== 'function')) throw new TypeError('approval gate read contract is required when provided');
    this.runner = runner;
    this.runtime = runtime;
    this.store = store;
    this.notificationSimulation = notificationSimulation;
    this.aiAnalyst = aiAnalyst;
    this.aiOrchestrator = aiOrchestrator;
    this.aiPolicy = aiPolicy;
    this.approvalGate = approvalGate;
    this.sourceName = String(sourceName || 'axiom-security').slice(0, 80);
    this.staleAfterMs = staleAfterMs;
  }

  async getOverview({ now = new Date(), recentLimit = 10 } = {}) {
    const [incidents, sourceState, storeStats] = await Promise.all([
      this.store.listIncidents({ limit: Math.max(100, recentLimit) }),
      this.store.getSourceState(this.sourceName),
      this.store.stats()
    ]);
    const overview = buildSecurityCenterOverview({ runnerStatus: this.runner.status(), runtimeStatus: this.runtime ? this.runtime.status() : null, sourceState, storeStats, incidents, now, staleAfterMs: this.staleAfterMs, recentLimit });
    const notificationStatus = this.notificationSimulation ? this.notificationSimulation.status() : emptyNotificationSimulationStatus();
    const recentNotificationAudit = this.notificationSimulation ? this.notificationSimulation.listAudit({ limit: 10 }) : [];
    const aiStatus = this.aiAnalyst ? this.aiAnalyst.status() : emptyAiAnalystMockStatus();
    const recentAiAnalyses = this.aiAnalyst ? this.aiAnalyst.listRecent({ limit: 10 }) : [];
    const aiOrchestrator = this.aiOrchestrator ? { status: this.aiOrchestrator.status(), recentDecisions: this.aiOrchestrator.listDecisions({ limit: 10 }) } : { status: null, recentDecisions: [] };
    const aiPolicy = this.aiPolicy ? { status: this.aiPolicy.status(), recent: this.aiPolicy.listRecent({ limit: 10 }).map(item => ({ analyzedAt: item.analyzedAt, decision: item.policy?.decision || 'deny', reasonCode: item.policy?.reasonCode || 'POLICY_DENIED', actionCount: Number(item.policy?.actionCount || 0), executable: false })) } : { status: policyStatus(), recent: [] };
    const approvals = this.approvalGate ? { status: this.approvalGate.status(), recent: this.approvalGate.list({ limit: 10 }), recentAudit: this.approvalGate.listAudit({ limit: 10 }) } : { status: { enabled:false, actionRunnerAvailable:false, executionEnabled:false, simulationOnly:true }, recent: [], recentAudit: [] };
    return { ...overview, notifications: { status: notificationStatus, recentAudit: recentNotificationAudit }, aiAnalyst: { status: aiStatus, recent: recentAiAnalyses }, aiOrchestrator, aiPolicy, approvals };
  }

  async listIncidents({ status, severity, limit } = {}) {
    const safeStatus = validateOptionalFilter(status, ALLOWED_STATUSES, 'status');
    const safeSeverity = validateOptionalFilter(severity, ALLOWED_SEVERITIES, 'severity');
    const safeLimit = validateLimit(limit, 100);
    const incidents = await this.store.listIncidents({ status: safeStatus, severity: safeSeverity, limit: safeLimit });
    return incidents.map(pickIncident);
  }

  async getNotifications({ limit } = {}) {
    const safeLimit = validateLimit(limit, 50);
    if (!this.notificationSimulation) return { status: emptyNotificationSimulationStatus(), audit: [] };
    return { status: this.notificationSimulation.status(), audit: this.notificationSimulation.listAudit({ limit: safeLimit }) };
  }

  async getAiAnalyses({ limit } = {}) {
    const safeLimit = validateLimit(limit, 50);
    if (!this.aiAnalyst) return { status: emptyAiAnalystMockStatus(), analyses: [] };
    return { status: this.aiAnalyst.status(), analyses: this.aiAnalyst.listRecent({ limit: safeLimit }) };
  }

  async getAiOrchestrator({ limit } = {}) {
    const safeLimit = validateLimit(limit, 20);
    if (!this.aiOrchestrator) return { status: null, decisions: [] };
    return { status: this.aiOrchestrator.status(), decisions: this.aiOrchestrator.listDecisions({ limit: Math.min(safeLimit, 100) }) };
  }

  async getAiPolicy({ limit } = {}) {
    const safeLimit = validateLimit(limit, 20);
    if (!this.aiPolicy) return { status: policyStatus(), decisions: [] };
    const status = this.aiPolicy.status();
    const decisions = this.aiPolicy.listRecent({ limit: Math.min(safeLimit, 100) }).map(item => Object.freeze({ analyzedAt: item.analyzedAt, decision: item.policy?.decision || 'deny', reasonCode: item.policy?.reasonCode || 'POLICY_DENIED', actionCount: Number(item.policy?.actionCount || 0), executable: false }));
    return { status, decisions };
  }

  async getApprovals({ limit } = {}) {
    const safeLimit = validateLimit(limit, 20);
    if (!this.approvalGate) return { status: { enabled:false, actionRunnerAvailable:false, executionEnabled:false, simulationOnly:true }, approvals: [], audit: [] };
    return { status: this.approvalGate.status(), approvals: this.approvalGate.list({ limit: Math.min(safeLimit, 100) }), audit: this.approvalGate.listAudit({ limit: Math.min(safeLimit, 100) }) };
  }

  async getHealth({ now = new Date() } = {}) {
    const overview = await this.getOverview({ now, recentLimit: 1 });
    return { generatedAt: overview.generatedAt, shield: overview.shield, health: overview.health, alerts: overview.alerts, agent: overview.agent, telemetry: overview.telemetry, notifications: overview.notifications.status, aiAnalyst: overview.aiAnalyst.status, aiOrchestrator: overview.aiOrchestrator.status, aiPolicy: overview.aiPolicy.status, approvals: overview.approvals.status, openIncidentCount: overview.incidents.open, highestOpenSeverity: overview.incidents.highestOpenSeverity };
  }
}

module.exports = { SecurityCenterService, validateLimit, validateOptionalFilter };
