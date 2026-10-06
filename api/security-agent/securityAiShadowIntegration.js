const { evaluateAiPolicy, policyStatus } = require('./securityPolicyEngine');
const { SecurityApprovalGate } = require('./securityApprovalGate');

const AI_SHADOW_INTEGRATION_VERSION = 'v0.24';
const ALLOWED_BACKENDS = Object.freeze(['mock', 'gateway']);

function safeBackend(value) {
  return String(value ?? 'mock').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 32);
}

function buildAiShadowIntegrationConfig(env = {}) {
  const enabled = env.SECURITY_AI_SHADOW_INTEGRATION_ENABLED === 'true';
  const backend = safeBackend(env.SECURITY_AI_SHADOW_BACKEND || 'mock');
  const blockers = [];
  if (!enabled) blockers.push('integration_disabled');
  if (enabled && !ALLOWED_BACKENDS.includes(backend)) blockers.push('backend_not_allowlisted');
  return Object.freeze({
    version: AI_SHADOW_INTEGRATION_VERSION,
    enabled,
    backend,
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
}

function publicTargetStatus(value = {}) {
  const safe = {};
  for (const key of ['version', 'state', 'enabled', 'ready', 'simulated', 'provider', 'region', 'model']) {
    if (Object.prototype.hasOwnProperty.call(value, key)) safe[key] = value[key];
  }
  return Object.freeze(safe);
}

function normalizeAnalysis(value, analyzedAt, backend) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI_SHADOW_OUTPUT_INVALID');
  if (value.executable !== false) throw new Error('AI_SHADOW_EXECUTABLE_OUTPUT_FORBIDDEN');
  if (!Array.isArray(value.toolCalls) || value.toolCalls.length !== 0) throw new Error('AI_SHADOW_TOOL_CALLS_FORBIDDEN');
  const summary = String(value.summary || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!summary) throw new Error('AI_SHADOW_OUTPUT_INVALID');
  const policy = evaluateAiPolicy(value);
  return Object.freeze({
    analyzedAt,
    backend,
    assessment: String(value.assessment || 'uncertain').slice(0, 32),
    confidence: Number.isInteger(value.confidence) ? value.confidence : 0,
    prioritySuggestion: String(value.prioritySuggestion || 'P3').slice(0, 8),
    summary,
    hypotheses: Object.freeze(Array.isArray(value.hypotheses) ? value.hypotheses.slice(0, 5) : []),
    recommendedActions: Object.freeze(Array.isArray(value.recommendedActions) ? value.recommendedActions.slice(0, 5) : []),
    requiresHumanReview: value.requiresHumanReview === true,
    executable: false,
    toolCalls: Object.freeze([]),
    policy: Object.freeze({ version: policy.version, decision: policy.decision, reasonCode: policy.reasonCode, executable: false, actionCount: policy.actions.length })
  });
}

class SecurityAiShadowIntegration {
  constructor({ config = buildAiShadowIntegrationConfig(), mockRunner = null, modelGateway = null, approvalGate = null, maxRecent = 50, now = () => new Date() } = {}) {
    if (!config || typeof config !== 'object') throw new TypeError('AI shadow integration config is required');
    if (mockRunner !== null && (!mockRunner || typeof mockRunner.analyze !== 'function' || typeof mockRunner.status !== 'function')) throw new TypeError('mock runner contract is required');
    if (modelGateway !== null && (!modelGateway || typeof modelGateway.analyze !== 'function' || typeof modelGateway.status !== 'function')) throw new TypeError('model gateway contract is required');
    if (typeof now !== 'function') throw new TypeError('AI shadow integration clock is required');
    this.config = config;
    this.mockRunner = mockRunner;
    this.modelGateway = modelGateway;
    this.approvalGate = approvalGate;
    this.maxRecent = Number.isInteger(maxRecent) && maxRecent > 0 && maxRecent <= 200 ? maxRecent : 50;
    this.now = now;
    this.recent = [];
    this.runCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.lastRunAt = null;
    this.lastErrorCode = null;
    this.policyCounters = { allow: 0, deny: 0, escalate: 0 };
  }

  _target() {
    return this.config.backend === 'gateway' ? this.modelGateway : this.mockRunner;
  }

  _fail(code) {
    this.failureCount += 1;
    this.lastErrorCode = code;
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  async analyze(input = {}) {
    this.runCount += 1;
    this.lastRunAt = this.now().toISOString();
    if (this.config.ready !== true) this._fail('AI_SHADOW_INTEGRATION_NOT_READY');
    const target = this._target();
    if (!target) this._fail('AI_SHADOW_TARGET_NOT_CONFIGURED');
    const targetStatus = target.status();
    if (this.config.backend === 'gateway' && targetStatus?.ready !== true) this._fail('AI_SHADOW_TARGET_NOT_READY');

    let raw;
    try {
      raw = await target.analyze(input);
    } catch (_error) {
      this._fail(this.config.backend === 'gateway' ? 'AI_SHADOW_GATEWAY_FAILED' : 'AI_SHADOW_MOCK_FAILED');
    }

    let record;
    try {
      record = normalizeAnalysis(raw, this.lastRunAt, this.config.backend);
    } catch (_error) {
      this._fail('AI_SHADOW_OUTPUT_INVALID');
    }
    this.successCount += 1;
    if (Object.prototype.hasOwnProperty.call(this.policyCounters, record.policy.decision)) this.policyCounters[record.policy.decision] += 1;
    if (record.policy.decision === 'escalate' && this.approvalGate) {
      const rawPolicy = evaluateAiPolicy(raw);
      for (const item of rawPolicy.actions.filter(action => action.decision === 'escalate')) {
        this.approvalGate.request({ action: item.action, reasonCode: item.reasonCode, priority: record.prioritySuggestion });
      }
    }
    this.lastErrorCode = null;
    this.recent.push(record);
    if (this.recent.length > this.maxRecent) this.recent.splice(0, this.recent.length - this.maxRecent);
    return record;
  }

  status() {
    const target = this._target();
    const targetStatus = target ? target.status() : {};
    const targetReady = this.config.backend === 'gateway' ? targetStatus?.ready === true : Boolean(target);
    let state = 'ready';
    if (this.config.enabled !== true) state = 'disabled';
    else if (this.config.ready !== true) state = 'blocked';
    else if (!target) state = 'target_unconfigured';
    else if (!targetReady) state = 'target_not_ready';
    else if (this.lastErrorCode) state = 'error';
    return Object.freeze({
      version: AI_SHADOW_INTEGRATION_VERSION,
      state,
      enabled: this.config.enabled === true,
      ready: this.config.ready === true && targetReady,
      backend: this.config.backend,
      blockers: this.config.blockers,
      runCount: this.runCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      lastRunAt: this.lastRunAt,
      lastErrorCode: this.lastErrorCode,
      target: publicTargetStatus(targetStatus),
      policy: Object.freeze({ ...policyStatus(), counters: Object.freeze({ ...this.policyCounters }) }),
      approvalGate: this.approvalGate ? this.approvalGate.status() : Object.freeze({ enabled: false, actionRunnerAvailable: false, executionEnabled: false })
    });
  }

  listRecent({ limit = 20 } = {}) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw new Error('invalid AI shadow recent limit');
    return Object.freeze(this.recent.slice(-parsed).reverse().map(item => Object.freeze({ ...item })));
  }
}

function createSecurityAiShadowIntegration({ env = {}, mockRunner = null, modelGateway = null, providerAdapter = null, approvalGate = null, maxRecent = 50, now = () => new Date() } = {}) {
  const config = buildAiShadowIntegrationConfig(env);
  if (!mockRunner && config.backend === 'mock') {
    const { SecurityAiAnalystMockRunner } = require('./securityAiAnalystMockRunner');
    mockRunner = new SecurityAiAnalystMockRunner();
  }
  if (!modelGateway && config.backend === 'gateway') {
    const { buildModelGatewayConfig, SecurityAiModelGateway } = require('./securityAiModelGateway');
    const gatewayConfig = buildModelGatewayConfig(env);
    if (!providerAdapter && gatewayConfig.ready === true && gatewayConfig.provider === 'groq') {
      const { buildGroqSecurityProviderConfig, createGroqSecurityAiProvider } = require('./securityAiGroqProvider');
      const groqConfig = buildGroqSecurityProviderConfig(env);
      if (groqConfig.ready === true) providerAdapter = createGroqSecurityAiProvider({ env, config: groqConfig });
    }
    modelGateway = new SecurityAiModelGateway({ config: gatewayConfig, providerAdapter, now });
  }
  if (!approvalGate) approvalGate = new SecurityApprovalGate({ now });
  return new SecurityAiShadowIntegration({ config, mockRunner, modelGateway, approvalGate, maxRecent, now });
}

module.exports = {
  AI_SHADOW_INTEGRATION_VERSION,
  ALLOWED_BACKENDS,
  buildAiShadowIntegrationConfig,
  SecurityAiShadowIntegration,
  createSecurityAiShadowIntegration
};
