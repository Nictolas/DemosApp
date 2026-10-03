const { MemorySecurityStore } = require('./securityStore');
const { PostgresSecurityStore } = require('./postgresSecurityStore');
const { createAxiomReadOnlySecuritySource } = require('./readOnlySecuritySource');
const { createShadowSecurityRunner } = require('./shadowRunner');
const { createPoolForPurpose } = require('./securityDbCredentialGate');

const RUNTIME_MODES = new Set(['memory', 'postgres']);

function runtimeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseInterval(value) {
  const intervalMs = Number(value ?? 60000);
  if (!Number.isInteger(intervalMs) || intervalMs < 10000 || intervalMs > 3600000) {
    throw runtimeError('SECURITY_RUNTIME_INTERVAL_INVALID');
  }
  return intervalMs;
}

function buildSecurityAgentRuntimeConfig(env = process.env) {
  const processEnabled = env.SECURITY_AGENT_PROCESS_ENABLED === 'true';
  const sourceEnabled = env.SECURITY_AGENT_SHADOW_ENABLED === 'true';
  const runnerEnabled = env.SECURITY_AGENT_RUNNER_ENABLED === 'true';
  const mode = String(env.SECURITY_AGENT_RUNTIME_MODE || 'memory').toLowerCase();
  if (!RUNTIME_MODES.has(mode)) throw runtimeError('SECURITY_RUNTIME_MODE_INVALID');

  const intervalMs = parseInterval(env.SECURITY_AGENT_RUNNER_INTERVAL_MS);
  const runImmediately = env.SECURITY_AGENT_RUN_IMMEDIATELY === 'true';
  const environment = String(env.NODE_ENV || 'unknown').slice(0, 32);
  if (processEnabled && environment === 'production' && mode === 'memory') {
    throw runtimeError('SECURITY_RUNTIME_MEMORY_FORBIDDEN_IN_PRODUCTION');
  }
  const ready = processEnabled && sourceEnabled && runnerEnabled;
  const blockers = [];
  if (!processEnabled) blockers.push('process_disabled');
  if (!sourceEnabled) blockers.push('source_disabled');
  if (!runnerEnabled) blockers.push('runner_disabled');

  return Object.freeze({
    processEnabled,
    sourceEnabled,
    runnerEnabled,
    ready,
    blockers: Object.freeze(blockers),
    mode,
    intervalMs,
    runImmediately,
    environment
  });
}

class SecurityAgentRuntime {
  constructor({ config, runner = null, resources = [], credentialStatus = null } = {}) {
    if (!config || typeof config !== 'object') throw new TypeError('runtime config is required');
    this.config = config;
    this.runner = runner;
    this.resources = Array.isArray(resources) ? resources : [];
    this.credentialStatus = credentialStatus;
    this.timer = null;
    this.inFlight = null;
    this.startedAt = null;
    this.stoppedAt = null;
    this.lastCycleAt = null;
    this.lastCycleStatus = 'never';
    this.cycleCount = 0;
    this.shutdownRequested = false;
  }

  start() {
    if (!this.config.ready || !this.runner) return false;
    if (this.timer || this.inFlight) return false;
    this.shutdownRequested = false;
    this.startedAt = new Date().toISOString();
    this.stoppedAt = null;
    this.#schedule(this.config.runImmediately ? 0 : this.config.intervalMs);
    return true;
  }

  async runCycle() {
    if (!this.config.ready || !this.runner) return { status: 'disabled' };
    if (this.inFlight) return { status: 'skipped_busy' };

    this.cycleCount += 1;
    this.lastCycleAt = new Date().toISOString();
    const operation = Promise.resolve().then(() => this.runner.runOnce());
    this.inFlight = operation;
    try {
      const result = await operation;
      this.lastCycleStatus = String(result?.status || 'unknown').slice(0, 32);
      return result;
    } catch (_error) {
      this.lastCycleStatus = 'error';
      return { status: 'error', errorCode: 'SECURITY_RUNTIME_CYCLE_FAILED' };
    } finally {
      this.inFlight = null;
    }
  }

  async stop({ timeoutMs = 5000 } = {}) {
    this.shutdownRequested = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.inFlight) {
      await Promise.race([
        this.inFlight.catch(() => {}),
        new Promise(resolve => setTimeout(resolve, Math.max(1, timeoutMs)))
      ]);
    }

    for (const resource of this.resources) {
      try {
        if (resource && typeof resource.end === 'function') await resource.end();
        else if (resource && typeof resource.close === 'function') await resource.close();
      } catch (_error) {}
    }
    this.stoppedAt = new Date().toISOString();
    return true;
  }

  status() {
    const runnerStatus = this.runner && typeof this.runner.status === 'function'
      ? this.runner.status()
      : null;
    const state = !this.config.ready
      ? 'disabled'
      : (this.shutdownRequested && this.stoppedAt ? 'stopped' : (this.timer || this.inFlight ? 'running' : 'ready'));
    return Object.freeze({
      component: 'demos-security-agent',
      state,
      mode: this.config.mode,
      environment: this.config.environment,
      blockers: [...this.config.blockers],
      intervalMs: this.config.intervalMs,
      runImmediately: this.config.runImmediately,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      lastCycleAt: this.lastCycleAt,
      lastCycleStatus: this.lastCycleStatus,
      cycleCount: this.cycleCount,
      shutdownRequested: this.shutdownRequested,
      runner: runnerStatus ? {
        enabled: runnerStatus.enabled === true,
        inFlight: runnerStatus.inFlight === true,
        lastRunStatus: String(runnerStatus.lastRunStatus || 'never').slice(0, 32),
        runCount: Number(runnerStatus.runCount || 0),
        failureCount: Number(runnerStatus.failureCount || 0)
      } : null,
      database: this.credentialStatus ? Object.freeze({
        enabled: this.credentialStatus.enabled === true,
        purpose: String(this.credentialStatus.purpose || 'writer').slice(0, 32),
        configured: this.credentialStatus.configured === true || this.credentialStatus.enabled === true,
        role: this.credentialStatus.enabled === true ? String(this.credentialStatus.role || this.credentialStatus.username || '').slice(0, 80) : null,
        retentionDays: this.credentialStatus.enabled === true ? Number(this.credentialStatus.retentionDays || 0) : null,
        tlsVerified: this.credentialStatus.enabled === true
          ? (this.credentialStatus.tlsVerified === true || this.credentialStatus.poolConfig?.ssl?.rejectUnauthorized === true)
          : null
      }) : {
        enabled: false,
        purpose: 'writer',
        configured: false,
        role: null,
        retentionDays: null,
        tlsVerified: null
      }
    });
  }

  #schedule(delayMs) {
    if (this.shutdownRequested) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.runCycle();
      if (!this.shutdownRequested) this.#schedule(this.config.intervalMs);
    }, delayMs);
  }
}

function createSecurityAgentRuntime({
  env = process.env,
  sourceFactory = createAxiomReadOnlySecuritySource,
  runnerFactory = createShadowSecurityRunner,
  PoolCtor
} = {}) {
  const config = buildSecurityAgentRuntimeConfig(env);
  if (!config.ready) return new SecurityAgentRuntime({ config });

  let store;
  const resources = [];
  let credentialStatus = null;

  if (config.mode === 'postgres') {
    const ResolvedPool = PoolCtor || require('pg').Pool;
    const writer = createPoolForPurpose({ env, purpose: 'writer', PoolCtor: ResolvedPool });
    if (!writer.enabled || !writer.pool) throw runtimeError('SECURITY_RUNTIME_POSTGRES_NOT_READY');
    resources.push(writer.pool);
    credentialStatus = writer.status;
    const retentionMs = Number(writer.status.retentionDays) * 24 * 60 * 60 * 1000;
    store = new PostgresSecurityStore({ pool: writer.pool, retentionMs });
  } else {
    store = new MemorySecurityStore();
  }

  const source = sourceFactory({ env });
  const runner = runnerFactory({ source, store, env, intervalMs: config.intervalMs });
  return new SecurityAgentRuntime({ config, runner, resources, credentialStatus });
}

module.exports = {
  RUNTIME_MODES,
  buildSecurityAgentRuntimeConfig,
  SecurityAgentRuntime,
  createSecurityAgentRuntime
};
