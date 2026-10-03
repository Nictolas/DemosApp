const { MemorySecurityStore } = require('./securityStore');

function publicAiAnalysisResult(value = {}) {
  const safe = { status: String(value.status || 'unknown').slice(0, 48) };
  for (const key of ['eligibleCount', 'selectedCount', 'duplicateCount', 'cooldownCount', 'belowThresholdCount', 'closedCount']) {
    if (Number.isFinite(Number(value[key]))) safe[key] = Math.max(0, Math.floor(Number(value[key])));
  }
  if (value.errorCode) safe.errorCode = String(value.errorCode).replace(/[^A-Z0-9_]/g, '_').slice(0, 64);
  return safe;
}

class ShadowSecurityRunner {
  constructor({
    source,
    store = new MemorySecurityStore(),
    aiOrchestrator = null,
    enabled = false,
    sourceName = 'axiom-security',
    intervalMs = 60 * 1000
  } = {}) {
    if (!source || typeof source.poll !== 'function' || typeof source.checkHeartbeat !== 'function' || typeof source.status !== 'function') {
      throw new TypeError('source must implement poll(), checkHeartbeat() and status()');
    }
    if (!store || typeof store.upsertIncidents !== 'function' || typeof store.saveSourceState !== 'function') {
      throw new TypeError('store must implement the Security Store contract');
    }
    if (aiOrchestrator !== null && (!aiOrchestrator || typeof aiOrchestrator.analyzeCycle !== 'function' || typeof aiOrchestrator.status !== 'function')) {
      throw new TypeError('aiOrchestrator must implement analyzeCycle() and status()');
    }
    if (!Number.isInteger(intervalMs) || intervalMs < 10 * 1000 || intervalMs > 60 * 60 * 1000) {
      throw new Error('intervalMs must be an integer between 10000 and 3600000');
    }

    this.source = source;
    this.store = store;
    this.aiOrchestrator = aiOrchestrator;
    this.enabled = enabled === true;
    this.sourceName = String(sourceName || 'axiom-security').slice(0, 80);
    this.intervalMs = intervalMs;
    this.timer = null;
    this.inFlight = false;
    this.lastRunAt = null;
    this.lastRunStatus = 'never';
    this.runCount = 0;
    this.failureCount = 0;
  }

  async runOnce({ now = new Date() } = {}) {
    const runTime = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(runTime.getTime())) throw new Error('invalid runner timestamp');

    if (!this.enabled) return { status: 'disabled' };
    if (this.inFlight) return { status: 'skipped_busy' };

    this.inFlight = true;
    this.runCount += 1;
    this.lastRunAt = runTime.toISOString();

    try {
      const poll = await this.source.poll({ now: runTime });
      const heartbeat = await this.source.checkHeartbeat({ now: runTime });
      const incidents = this.#readIncidents();
      const storedIncidents = await this.store.upsertIncidents(incidents, runTime);
      const sourceState = await this.store.saveSourceState(this.sourceName, this.source.status(), runTime);
      const pruned = typeof this.store.prune === 'function'
        ? await this.store.prune({ now: runTime })
        : 0;

      let aiAnalysis = { status: 'not_configured' };
      if (this.aiOrchestrator) {
        try {
          aiAnalysis = publicAiAnalysisResult(await this.aiOrchestrator.analyzeCycle({ incidents, now: runTime }));
        } catch (_error) {
          aiAnalysis = { status: 'error', errorCode: 'AI_ORCHESTRATION_FAILED' };
        }
      }

      this.lastRunStatus = poll.status === 'error' ? 'degraded' : 'ok';
      if (poll.status === 'error') this.failureCount += 1;

      return {
        status: this.lastRunStatus,
        poll: {
          status: poll.status,
          fetched: Number(poll.fetched || 0),
          accepted: Number(poll.accepted || 0),
          duplicates: Number(poll.duplicates || 0),
          watermark: poll.watermark || null
        },
        heartbeat: {
          status: heartbeat.status,
          incidentCreated: heartbeat.incidentCreated === true
        },
        storedIncidentCount: storedIncidents.length,
        prunedIncidentCount: pruned,
        aiAnalysis,
        sourceState
      };
    } catch (_error) {
      this.lastRunStatus = 'error';
      this.failureCount += 1;
      return { status: 'error', errorCode: 'SECURITY_RUNNER_FAILED' };
    } finally {
      this.inFlight = false;
    }
  }

  start() {
    if (!this.enabled) return false;
    if (this.timer) return false;
    this.timer = setInterval(() => {
      this.runOnce().catch(() => {});
    }, this.intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    return true;
  }

  stop() {
    if (!this.timer) return false;
    clearInterval(this.timer);
    this.timer = null;
    return true;
  }

  status() {
    return {
      enabled: this.enabled,
      running: this.timer !== null,
      inFlight: this.inFlight,
      intervalMs: this.intervalMs,
      lastRunAt: this.lastRunAt,
      lastRunStatus: this.lastRunStatus,
      runCount: this.runCount,
      failureCount: this.failureCount,
      aiOrchestrator: this.aiOrchestrator ? this.aiOrchestrator.status() : null
    };
  }

  #readIncidents() {
    const pipeline = this.source.pipeline;
    if (!pipeline || typeof pipeline.snapshot !== 'function') return [];
    const snapshot = pipeline.snapshot();
    return Array.isArray(snapshot?.incidents) ? snapshot.incidents : [];
  }
}

function createShadowSecurityRunner({
  source,
  store,
  aiOrchestrator,
  env = process.env,
  intervalMs,
  sourceName
} = {}) {
  if (!source) {
    const { createAxiomReadOnlySecuritySource } = require('./readOnlySecuritySource');
    source = createAxiomReadOnlySecuritySource({ env });
  }
  if (aiOrchestrator === undefined) {
    const { createSecurityAiAnalysisOrchestrator } = require('./securityAiAnalysisOrchestrator');
    aiOrchestrator = createSecurityAiAnalysisOrchestrator({ env });
  }
  return new ShadowSecurityRunner({
    source,
    store,
    aiOrchestrator,
    enabled: env.SECURITY_AGENT_RUNNER_ENABLED === 'true',
    intervalMs: intervalMs || Number(env.SECURITY_AGENT_RUNNER_INTERVAL_MS || 60 * 1000),
    sourceName
  });
}

module.exports = {
  ShadowSecurityRunner,
  createShadowSecurityRunner,
  publicAiAnalysisResult
};