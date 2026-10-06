const { buildModelGatewayConfig } = require('./securityAiModelGateway');
const { buildGroqSecurityProviderConfig } = require('./securityAiGroqProvider');

const STAGING_ISOLATION_VERSION = 'v0.79';
const NON_PROD_DATASET_MARKER = /(staging|stage|sandbox|preview|test)/i;
const PROD_MARKER = /(^|[-_.])(prod|production)($|[-_.])/i;

function safeLabel(value, max = 96) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_.:.-]/g, '_').slice(0, max);
}

function safeDataset(value) {
  return String(value ?? '').trim().replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 160);
}

function enabled(env, key) {
  return env[key] === 'true';
}

function buildSecurityStagingIsolationConfig(env = {}) {
  const required = enabled(env, 'SECURITY_AGENT_STAGING_ISOLATION_REQUIRED');
  const environmentClass = safeLabel(env.SECURITY_AGENT_ENVIRONMENT_CLASS);
  const stagingId = safeLabel(env.SECURITY_AGENT_STAGING_ID, 120);
  const runtimeMode = safeLabel(env.SECURITY_AGENT_RUNTIME_MODE || 'memory', 32);
  const dataset = safeDataset(env.AXIOM_REALTIME_DATASET);
  const aiBackend = safeLabel(env.SECURITY_AI_SHADOW_BACKEND || 'mock', 32);
  const blockers = [];

  if (required) {
    if (environmentClass !== 'staging') blockers.push('environment_class_not_staging');
    if (!stagingId) blockers.push('staging_id_missing');
    else if (PROD_MARKER.test(stagingId)) blockers.push('staging_id_production_marker');
    if (runtimeMode !== 'memory') blockers.push('persistent_store_forbidden');

    if (enabled(env, 'SECURITY_AGENT_STORE_ENABLED')) blockers.push('database_writer_forbidden');
    if (enabled(env, 'SECURITY_RETENTION_JOB_ENABLED')) blockers.push('retention_writer_forbidden');
    if (enabled(env, 'SECURITY_AGENT_ACTION_RUNNER_ENABLED') || enabled(env, 'SECURITY_ACTION_RUNNER_ENABLED') || enabled(env, 'ACTION_RUNNER_ENABLED')) {
      blockers.push('action_runner_forbidden');
    }

    if (enabled(env, 'SECURITY_AGENT_SHADOW_ENABLED')) {
      if (!enabled(env, 'AXIOM_ENABLED')) blockers.push('axiom_disabled');
      if (!dataset) blockers.push('axiom_dataset_missing');
      else if (!NON_PROD_DATASET_MARKER.test(dataset) || PROD_MARKER.test(dataset) || dataset.toLowerCase() === 'real-time') {
        blockers.push('axiom_dataset_not_isolated');
      }
    }

    if (enabled(env, 'SECURITY_AI_SHADOW_INTEGRATION_ENABLED') && aiBackend === 'gateway') {
      const gateway = buildModelGatewayConfig(env);
      const groq = buildGroqSecurityProviderConfig(env);
      if (gateway.ready !== true) blockers.push('ai_gateway_not_ready');
      if (groq.ready !== true) blockers.push('ai_provider_not_ready');
    }
  }

  return Object.freeze({
    version: STAGING_ISOLATION_VERSION,
    required,
    ready: blockers.length === 0,
    environmentClass: environmentClass || null,
    stagingId: stagingId || null,
    runtimeMode,
    axiom: Object.freeze({
      enabled: enabled(env, 'AXIOM_ENABLED'),
      dataset: dataset || null,
      isolatedDataset: Boolean(dataset && NON_PROD_DATASET_MARKER.test(dataset) && !PROD_MARKER.test(dataset) && dataset.toLowerCase() !== 'real-time')
    }),
    ai: Object.freeze({
      enabled: enabled(env, 'SECURITY_AI_SHADOW_INTEGRATION_ENABLED'),
      backend: aiBackend,
      gatewayEnabled: enabled(env, 'SECURITY_AI_MODEL_GATEWAY_ENABLED'),
      policyApproved: enabled(env, 'SECURITY_AI_PROVIDER_POLICY_APPROVED')
    }),
    actionRunnerAvailable: false,
    databaseWriterAllowed: false,
    blockers: Object.freeze(blockers)
  });
}

function assertSecurityStagingIsolation(env = {}) {
  const config = buildSecurityStagingIsolationConfig(env);
  if (config.required && !config.ready) {
    const error = new Error('SECURITY_STAGING_ISOLATION_BLOCKED');
    error.code = 'SECURITY_STAGING_ISOLATION_BLOCKED';
    error.blockers = config.blockers;
    throw error;
  }
  return config;
}

module.exports = {
  STAGING_ISOLATION_VERSION,
  NON_PROD_DATASET_MARKER,
  buildSecurityStagingIsolationConfig,
  assertSecurityStagingIsolation
};
