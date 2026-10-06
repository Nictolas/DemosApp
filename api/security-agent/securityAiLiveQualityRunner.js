const { buildSecurityStagingIsolationConfig, assertSecurityStagingIsolation } = require('./securityStagingIsolation');
const { buildModelGatewayConfig, SecurityAiModelGateway } = require('./securityAiModelGateway');
const { buildGroqSecurityProviderConfig, createGroqSecurityAiProvider } = require('./securityAiGroqProvider');
const { evaluateAiProviderQuality } = require('./securityAiQualityEvaluation');

const AI_LIVE_QUALITY_RUNNER_VERSION = 'v0.82';
const DEFAULT_MIN_PASS_RATE = 0.8;

function enabled(env, key) {
  return env[key] === 'true';
}

function parsePassRate(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_MIN_PASS_RATE;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 1 ? parsed : null;
}

function buildAiLiveQualityRunnerConfig(env = {}) {
  const liveEnabled = enabled(env, 'SECURITY_AI_PROVIDER_QUALITY_LIVE_ENABLED');
  const minPassRate = parsePassRate(env.SECURITY_AI_PROVIDER_QUALITY_MIN_PASS_RATE);
  const isolation = buildSecurityStagingIsolationConfig(env);
  const gateway = buildModelGatewayConfig(env);
  const groq = buildGroqSecurityProviderConfig(env);
  const blockers = [];

  if (liveEnabled) {
    if (!enabled(env, 'SECURITY_AGENT_STAGING_ISOLATION_REQUIRED')) blockers.push('staging_isolation_not_required');
    if (isolation.ready !== true) blockers.push('staging_isolation_not_ready');
    if (!enabled(env, 'SECURITY_AI_SHADOW_INTEGRATION_ENABLED')) blockers.push('shadow_integration_disabled');
    if (String(env.SECURITY_AI_SHADOW_BACKEND || '').trim().toLowerCase() !== 'gateway') blockers.push('shadow_backend_not_gateway');
    if (gateway.ready !== true) blockers.push('model_gateway_not_ready');
    if (groq.ready !== true) blockers.push('groq_provider_not_ready');
    if (minPassRate === null) blockers.push('quality_pass_rate_invalid');
  }

  return Object.freeze({
    version: AI_LIVE_QUALITY_RUNNER_VERSION,
    enabled: liveEnabled,
    ready: liveEnabled && blockers.length === 0,
    minPassRate: minPassRate ?? DEFAULT_MIN_PASS_RATE,
    provider: groq.provider,
    region: groq.region,
    model: groq.model,
    staging: Object.freeze({
      required: isolation.required === true,
      ready: isolation.ready === true,
      environmentClass: isolation.environmentClass,
      stagingId: isolation.stagingId,
      runtimeMode: isolation.runtimeMode,
      actionRunnerAvailable: false,
      databaseWriterAllowed: false
    }),
    blockers: Object.freeze(blockers)
  });
}

function publicRunResult(config, status, quality = null, extra = {}) {
  return Object.freeze({
    version: AI_LIVE_QUALITY_RUNNER_VERSION,
    status,
    enabled: config.enabled === true,
    ready: config.ready === true,
    provider: config.provider,
    region: config.region,
    model: config.model,
    staging: config.staging,
    accepted: quality ? quality.accepted === true : false,
    caseCount: quality ? quality.caseCount : 0,
    passedCount: quality ? quality.passedCount : 0,
    failedCount: quality ? quality.failedCount : 0,
    safetyFailureCount: quality ? quality.safetyFailureCount : 0,
    passRate: quality ? quality.passRate : 0,
    minPassRate: config.minPassRate,
    mandatoryFailed: quality ? quality.mandatoryFailed : Object.freeze([]),
    executable: false,
    toolCalls: Object.freeze([]),
    blockers: config.blockers,
    ...extra
  });
}

async function runLiveAiProviderQuality({
  env = process.env,
  client = null
} = {}) {
  const config = buildAiLiveQualityRunnerConfig(env);
  if (!config.enabled) return publicRunResult(config, 'disabled');
  if (!config.ready) return publicRunResult(config, 'blocked');

  try {
    assertSecurityStagingIsolation(env);
    const providerConfig = buildGroqSecurityProviderConfig(env);
    const provider = createGroqSecurityAiProvider({ env, config: providerConfig, client });
    if (!provider) return publicRunResult(config, 'blocked');
    const gateway = new SecurityAiModelGateway({
      config: buildModelGatewayConfig(env),
      providerAdapter: provider
    });
    const quality = await evaluateAiProviderQuality({
      analyze: input => gateway.analyze(input),
      minPassRate: config.minPassRate
    });
    return publicRunResult(config, quality.accepted ? 'accepted' : 'rejected', quality, {
      injectedClient: client !== null
    });
  } catch (_error) {
    return publicRunResult(config, 'error', null, {
      errorCode: 'AI_LIVE_QUALITY_RUN_FAILED',
      injectedClient: client !== null
    });
  }
}

module.exports = {
  AI_LIVE_QUALITY_RUNNER_VERSION,
  DEFAULT_MIN_PASS_RATE,
  buildAiLiveQualityRunnerConfig,
  runLiveAiProviderQuality
};
