const { buildAiAnalystRequest, validateAiAnalystOutput } = require('./securityAiAnalystContract');

const MODEL_GATEWAY_VERSION = 'v0.17';
const DEFAULT_TIMEOUT_MS = 8000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;

function safeId(value, max = 96) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_./:\-]/g, '_')
    .slice(0, max);
}

function parseCsv(value, maxItems = 20) {
  if (!value) return Object.freeze([]);
  const items = String(value)
    .split(',')
    .map(item => safeId(item))
    .filter(Boolean);
  return Object.freeze([...new Set(items)].slice(0, maxItems));
}

function parsePositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function buildModelGatewayConfig(env = {}) {
  const enabled = env.SECURITY_AI_MODEL_GATEWAY_ENABLED === 'true';
  const policyApproved = env.SECURITY_AI_PROVIDER_POLICY_APPROVED === 'true';
  const provider = safeId(env.SECURITY_AI_PROVIDER);
  const region = safeId(env.SECURITY_AI_REGION);
  const model = safeId(env.SECURITY_AI_MODEL);
  const providerAllowlist = parseCsv(env.SECURITY_AI_PROVIDER_ALLOWLIST);
  const regionAllowlist = parseCsv(env.SECURITY_AI_REGION_ALLOWLIST);
  const modelAllowlist = parseCsv(env.SECURITY_AI_MODEL_ALLOWLIST);
  const timeoutMs = parsePositiveInt(env.SECURITY_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, { min: MIN_TIMEOUT_MS, max: MAX_TIMEOUT_MS });
  const maxRequestCostMicros = parsePositiveInt(env.SECURITY_AI_MAX_REQUEST_COST_MICROS, 0, { min: 1, max: 1_000_000_000 });
  const dailyCostBudgetMicros = parsePositiveInt(env.SECURITY_AI_DAILY_COST_BUDGET_MICROS, 0, { min: 1, max: 10_000_000_000 });
  const maxDailyRequests = parsePositiveInt(env.SECURITY_AI_MAX_DAILY_REQUESTS, 0, { min: 1, max: 100_000 });

  const blockers = [];
  if (!enabled) blockers.push('gateway_disabled');
  if (enabled && !policyApproved) blockers.push('provider_policy_not_approved');
  if (enabled && !provider) blockers.push('provider_missing');
  if (enabled && provider && !providerAllowlist.includes(provider)) blockers.push('provider_not_allowlisted');
  if (enabled && !region) blockers.push('region_missing');
  if (enabled && region && !regionAllowlist.includes(region)) blockers.push('region_not_allowlisted');
  if (enabled && !model) blockers.push('model_missing');
  if (enabled && model && !modelAllowlist.includes(model)) blockers.push('model_not_allowlisted');
  if (enabled && maxRequestCostMicros <= 0) blockers.push('request_cost_cap_missing');
  if (enabled && dailyCostBudgetMicros <= 0) blockers.push('daily_cost_budget_missing');
  if (enabled && maxDailyRequests <= 0) blockers.push('daily_request_cap_missing');

  return Object.freeze({
    version: MODEL_GATEWAY_VERSION,
    enabled,
    ready: blockers.length === 0,
    policyApproved,
    provider: provider || null,
    region: region || null,
    model: model || null,
    providerAllowlist,
    regionAllowlist,
    modelAllowlist,
    timeoutMs,
    maxRequestCostMicros,
    dailyCostBudgetMicros,
    maxDailyRequests,
    blockers: Object.freeze(blockers)
  });
}

function utcDay(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('invalid gateway timestamp');
  return date.toISOString().slice(0, 10);
}

function genericError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

class SecurityAiModelGateway {
  constructor({ config = buildModelGatewayConfig(), providerAdapter = null, now = () => new Date() } = {}) {
    if (!config || typeof config !== 'object') throw new TypeError('model gateway config is required');
    if (typeof now !== 'function') throw new TypeError('model gateway clock is required');
    this.config = config;
    this.providerAdapter = providerAdapter;
    this.now = now;
    this.usageDay = utcDay(this.now());
    this.requestCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.costMicros = 0;
    this.lastRunAt = null;
    this.lastErrorCode = null;

    if (providerAdapter !== null) {
      if (!providerAdapter || typeof providerAdapter.analyze !== 'function' || typeof providerAdapter.estimateCostMicros !== 'function') {
        throw new TypeError('model provider adapter contract is required');
      }
      if (providerAdapter.toolAccess === true || providerAdapter.writeAccess === true) {
        throw new Error('model provider adapter cannot have tool/write access');
      }
      const adapterProvider = safeId(providerAdapter.provider);
      const adapterRegion = safeId(providerAdapter.region);
      const adapterModel = safeId(providerAdapter.model);
      if (config.provider && adapterProvider !== config.provider) throw new Error('model provider mismatch');
      if (config.region && adapterRegion !== config.region) throw new Error('model region mismatch');
      if (config.model && adapterModel !== config.model) throw new Error('model mismatch');
    }
  }

  _rollUsageDay() {
    const currentDay = utcDay(this.now());
    if (currentDay !== this.usageDay) {
      this.usageDay = currentDay;
      this.requestCount = 0;
      this.successCount = 0;
      this.failureCount = 0;
      this.costMicros = 0;
    }
    return currentDay;
  }

  _fail(code) {
    this.failureCount += 1;
    this.lastErrorCode = code;
    throw genericError(code);
  }

  _ensureReady() {
    if (this.config.ready !== true) this._fail('AI_MODEL_GATEWAY_NOT_READY');
    if (!this.providerAdapter) this._fail('AI_MODEL_PROVIDER_NOT_CONFIGURED');
  }

  async analyze(input = {}) {
    this._rollUsageDay();
    this.lastRunAt = this.now().toISOString();
    this._ensureReady();

    if (this.requestCount >= this.config.maxDailyRequests) {
      this._fail('AI_MODEL_DAILY_REQUEST_LIMIT');
    }

    const request = buildAiAnalystRequest(input);
    if (!Array.isArray(request.tools) || request.tools.length !== 0) {
      this._fail('AI_MODEL_TOOLS_FORBIDDEN');
    }

    let estimatedCostMicros;
    try {
      estimatedCostMicros = Number(await this.providerAdapter.estimateCostMicros(request));
    } catch (_error) {
      this._fail('AI_MODEL_COST_ESTIMATE_FAILED');
    }
    if (!Number.isInteger(estimatedCostMicros) || estimatedCostMicros < 0) {
      this._fail('AI_MODEL_COST_ESTIMATE_INVALID');
    }
    if (estimatedCostMicros > this.config.maxRequestCostMicros) {
      this._fail('AI_MODEL_REQUEST_COST_LIMIT');
    }
    if (this.costMicros + estimatedCostMicros > this.config.dailyCostBudgetMicros) {
      this._fail('AI_MODEL_DAILY_COST_LIMIT');
    }

    this.requestCount += 1;
    let timeoutHandle;
    const timeout = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => reject(genericError('AI_MODEL_TIMEOUT')), this.config.timeoutMs);
    });

    let response;
    try {
      response = await Promise.race([this.providerAdapter.analyze(request), timeout]);
    } catch (error) {
      this._fail(error?.code === 'AI_MODEL_TIMEOUT' ? 'AI_MODEL_TIMEOUT' : 'AI_MODEL_PROVIDER_FAILED');
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    const output = response && typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'output')
      ? response.output
      : response;
    const actualCostMicros = response && typeof response === 'object' && Object.prototype.hasOwnProperty.call(response, 'costMicros')
      ? Number(response.costMicros)
      : estimatedCostMicros;

    if (!Number.isInteger(actualCostMicros) || actualCostMicros < 0 || actualCostMicros > estimatedCostMicros) {
      this.costMicros += Math.max(0, Number.isFinite(actualCostMicros) ? Math.floor(actualCostMicros) : 0);
      this._fail('AI_MODEL_COST_ACCOUNTING_VIOLATION');
    }
    this.costMicros += actualCostMicros;

    let validated;
    try {
      validated = validateAiAnalystOutput(output);
    } catch (_error) {
      this._fail('AI_MODEL_OUTPUT_INVALID');
    }

    this.successCount += 1;
    this.lastErrorCode = null;
    return Object.freeze({
      ...validated,
      executable: false,
      toolCalls: Object.freeze([]),
      gateway: Object.freeze({
        version: MODEL_GATEWAY_VERSION,
        provider: this.config.provider,
        region: this.config.region,
        model: this.config.model,
        simulated: this.providerAdapter.simulated === true
      })
    });
  }

  status() {
    this._rollUsageDay();
    return Object.freeze({
      version: MODEL_GATEWAY_VERSION,
      state: this.config.ready !== true ? 'blocked' : (this.providerAdapter ? 'ready' : 'provider_unconfigured'),
      enabled: this.config.enabled === true,
      ready: this.config.ready === true && Boolean(this.providerAdapter),
      policyApproved: this.config.policyApproved === true,
      provider: this.config.provider,
      region: this.config.region,
      model: this.config.model,
      blockers: this.config.blockers,
      timeoutMs: this.config.timeoutMs,
      limits: Object.freeze({
        maxRequestCostMicros: this.config.maxRequestCostMicros,
        dailyCostBudgetMicros: this.config.dailyCostBudgetMicros,
        maxDailyRequests: this.config.maxDailyRequests
      }),
      usage: Object.freeze({
        day: this.usageDay,
        requestCount: this.requestCount,
        successCount: this.successCount,
        failureCount: this.failureCount,
        costMicros: this.costMicros
      }),
      lastRunAt: this.lastRunAt,
      lastErrorCode: this.lastErrorCode
    });
  }
}

module.exports = {
  MODEL_GATEWAY_VERSION,
  DEFAULT_TIMEOUT_MS,
  buildModelGatewayConfig,
  SecurityAiModelGateway
};
