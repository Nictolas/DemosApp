const crypto = require('crypto');
const { createSecurityAiShadowIntegration } = require('./securityAiShadowIntegration');

const AI_ANALYSIS_ORCHESTRATOR_VERSION = 'v0.19';
const SEVERITY_RANK = Object.freeze({ info: 0, low: 1, medium: 2, high: 3, critical: 4 });
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
const DEFAULT_MAX_INCIDENTS = 10;
const DEFAULT_MAX_ANALYSES_PER_HOUR = 4;

function safeSeverity(value, fallback = 'high') {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_RANK, normalized) ? normalized : null;
}

function boundedInt(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return { value: fallback, valid: true };
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? { value: parsed, valid: true }
    : { value: fallback, valid: false };
}

function buildAiAnalysisOrchestratorConfig(env = {}) {
  const enabled = env.SECURITY_AI_ORCHESTRATOR_ENABLED === 'true';
  const minSeverity = safeSeverity(env.SECURITY_AI_ORCHESTRATOR_MIN_SEVERITY, 'high');
  const cooldown = boundedInt(env.SECURITY_AI_ORCHESTRATOR_COOLDOWN_MS, DEFAULT_COOLDOWN_MS, 60_000, 24 * 60 * 60 * 1000);
  const maxIncidents = boundedInt(env.SECURITY_AI_ORCHESTRATOR_MAX_INCIDENTS, DEFAULT_MAX_INCIDENTS, 1, 50);
  const maxPerHour = boundedInt(env.SECURITY_AI_ORCHESTRATOR_MAX_ANALYSES_PER_HOUR, DEFAULT_MAX_ANALYSES_PER_HOUR, 1, 60);
  const blockers = [];
  if (!enabled) blockers.push('orchestrator_disabled');
  if (enabled && !minSeverity) blockers.push('min_severity_invalid');
  if (enabled && !cooldown.valid) blockers.push('cooldown_invalid');
  if (enabled && !maxIncidents.valid) blockers.push('max_incidents_invalid');
  if (enabled && !maxPerHour.valid) blockers.push('hourly_limit_invalid');
  return Object.freeze({
    version: AI_ANALYSIS_ORCHESTRATOR_VERSION,
    enabled,
    ready: blockers.length === 0,
    minSeverity: minSeverity || 'high',
    cooldownMs: cooldown.value,
    maxIncidentsPerAnalysis: maxIncidents.value,
    maxAnalysesPerHour: maxPerHour.value,
    blockers: Object.freeze(blockers)
  });
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('invalid AI orchestrator timestamp');
  return date;
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 32);
}

function incidentKey(incident = {}) {
  const source = incident.incidentId || incident.findingId || incident.ruleId;
  return source ? hash(source) : null;
}

function incidentSignature(incident = {}) {
  return hash([
    incident.ruleId || '', incident.severity || '', incident.status || '', Number(incident.count || 0),
    incident.firstSeen || '', incident.lastSeen || '', incident.updatedAt || ''
  ].join('|'));
}

function hourBucket(date) {
  return date.toISOString().slice(0, 13);
}

function publicCycleResult(result = {}) {
  const safe = {};
  for (const key of ['status', 'eligibleCount', 'selectedCount', 'duplicateCount', 'cooldownCount', 'belowThresholdCount', 'closedCount']) {
    if (Object.prototype.hasOwnProperty.call(result, key)) safe[key] = result[key];
  }
  return Object.freeze(safe);
}

class SecurityAiAnalysisOrchestrator {
  constructor({ config = buildAiAnalysisOrchestratorConfig(), aiIntegration, now = () => new Date(), maxHistory = 5000 } = {}) {
    if (!config || typeof config !== 'object') throw new TypeError('AI orchestrator config is required');
    if (!aiIntegration || typeof aiIntegration.analyze !== 'function' || typeof aiIntegration.status !== 'function') {
      throw new TypeError('AI shadow integration contract is required');
    }
    if (typeof now !== 'function') throw new TypeError('AI orchestrator clock is required');
    if (!Number.isInteger(maxHistory) || maxHistory < 100 || maxHistory > 50000) throw new Error('invalid AI orchestrator history limit');
    this.config = config;
    this.aiIntegration = aiIntegration;
    this.now = now;
    this.maxHistory = maxHistory;
    this.history = new Map();
    this.historyOrder = [];
    this.bucket = hourBucket(asDate(this.now()));
    this.bucketCount = 0;
    this.runCount = 0;
    this.analysisCount = 0;
    this.failureCount = 0;
    this.lastRunAt = null;
    this.lastStatus = 'never';
    this.lastErrorCode = null;
  }

  _rollBucket(now) {
    const next = hourBucket(now);
    if (next !== this.bucket) {
      this.bucket = next;
      this.bucketCount = 0;
    }
  }

  _remember(key, value) {
    if (!this.history.has(key)) this.historyOrder.push(key);
    this.history.set(key, value);
    while (this.historyOrder.length > this.maxHistory) {
      const expired = this.historyOrder.shift();
      this.history.delete(expired);
    }
  }

  async analyzeCycle({ incidents = [], alerts = [], health = {}, now = this.now() } = {}) {
    const current = asDate(now);
    this.runCount += 1;
    this.lastRunAt = current.toISOString();
    this._rollBucket(current);

    if (this.config.ready !== true) {
      this.lastStatus = 'skipped_disabled';
      return publicCycleResult({ status: this.lastStatus, eligibleCount: 0, selectedCount: 0 });
    }

    const integrationStatus = this.aiIntegration.status();
    if (integrationStatus?.ready !== true) {
      this.lastStatus = 'skipped_target_not_ready';
      return publicCycleResult({ status: this.lastStatus, eligibleCount: 0, selectedCount: 0 });
    }

    if (!Array.isArray(incidents)) throw new TypeError('incidents must be an array');
    const threshold = SEVERITY_RANK[this.config.minSeverity];
    const candidates = [];
    let duplicateCount = 0;
    let cooldownCount = 0;
    let belowThresholdCount = 0;
    let closedCount = 0;

    for (const incident of incidents) {
      if (!incident || typeof incident !== 'object') continue;
      if (incident.status !== 'open') { closedCount += 1; continue; }
      const severity = safeSeverity(incident.severity, 'info') || 'info';
      if (SEVERITY_RANK[severity] < threshold) { belowThresholdCount += 1; continue; }
      const key = incidentKey(incident);
      if (!key) continue;
      const signature = incidentSignature(incident);
      const previous = this.history.get(key);
      const escalated = previous && SEVERITY_RANK[severity] > SEVERITY_RANK[previous.severity || 'info'];
      if (previous?.success === true && previous.signature === signature) { duplicateCount += 1; continue; }
      if (previous && !escalated && current.getTime() - previous.atMs < this.config.cooldownMs) { cooldownCount += 1; continue; }
      candidates.push({ incident, key, signature, severity, escalated });
    }

    candidates.sort((a, b) => {
      const severityDelta = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      if (severityDelta) return severityDelta;
      return String(b.incident.updatedAt || b.incident.lastSeen || '').localeCompare(String(a.incident.updatedAt || a.incident.lastSeen || ''));
    });

    const selected = candidates.slice(0, this.config.maxIncidentsPerAnalysis);
    const baseResult = {
      eligibleCount: candidates.length,
      selectedCount: selected.length,
      duplicateCount,
      cooldownCount,
      belowThresholdCount,
      closedCount
    };

    if (!selected.length) {
      this.lastStatus = 'skipped_no_eligible_incidents';
      return publicCycleResult({ status: this.lastStatus, ...baseResult });
    }
    if (this.bucketCount >= this.config.maxAnalysesPerHour) {
      this.lastStatus = 'skipped_rate_limit';
      return publicCycleResult({ status: this.lastStatus, ...baseResult });
    }

    this.bucketCount += 1;
    for (const item of selected) {
      this._remember(item.key, { signature: item.signature, severity: item.severity, atMs: current.getTime(), success: false });
    }

    try {
      await this.aiIntegration.analyze({ incidents: selected.map(item => item.incident), alerts, health, now: current });
      for (const item of selected) {
        this._remember(item.key, { signature: item.signature, severity: item.severity, atMs: current.getTime(), success: true });
      }
      this.analysisCount += 1;
      this.lastStatus = 'analyzed';
      this.lastErrorCode = null;
      return publicCycleResult({ status: this.lastStatus, ...baseResult });
    } catch (_error) {
      this.failureCount += 1;
      this.lastStatus = 'error';
      this.lastErrorCode = 'AI_ORCHESTRATOR_ANALYSIS_FAILED';
      return Object.freeze({ ...publicCycleResult({ status: this.lastStatus, ...baseResult }), errorCode: this.lastErrorCode });
    }
  }

  status() {
    this._rollBucket(asDate(this.now()));
    const integration = this.aiIntegration.status();
    return Object.freeze({
      version: AI_ANALYSIS_ORCHESTRATOR_VERSION,
      state: this.config.enabled !== true ? 'disabled' : (this.config.ready !== true ? 'blocked' : (integration?.ready === true ? 'ready' : 'target_not_ready')),
      enabled: this.config.enabled === true,
      ready: this.config.ready === true && integration?.ready === true,
      minSeverity: this.config.minSeverity,
      cooldownMs: this.config.cooldownMs,
      limits: Object.freeze({ maxIncidentsPerAnalysis: this.config.maxIncidentsPerAnalysis, maxAnalysesPerHour: this.config.maxAnalysesPerHour }),
      currentHourCount: this.bucketCount,
      runCount: this.runCount,
      analysisCount: this.analysisCount,
      failureCount: this.failureCount,
      lastRunAt: this.lastRunAt,
      lastStatus: this.lastStatus,
      lastErrorCode: this.lastErrorCode
    });
  }
}

function createSecurityAiAnalysisOrchestrator({ env = {}, aiIntegration = null, now = () => new Date() } = {}) {
  if (!aiIntegration) aiIntegration = createSecurityAiShadowIntegration({ env, now });
  return new SecurityAiAnalysisOrchestrator({ config: buildAiAnalysisOrchestratorConfig(env), aiIntegration, now });
}

module.exports = {
  AI_ANALYSIS_ORCHESTRATOR_VERSION,
  SEVERITY_RANK,
  buildAiAnalysisOrchestratorConfig,
  SecurityAiAnalysisOrchestrator,
  createSecurityAiAnalysisOrchestrator,
  publicCycleResult
};