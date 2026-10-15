const crypto = require('crypto');
const { ShadowSecurityPipeline } = require('./shadowPipeline');
const { createSecurityAxiomReadOnlyProvider } = require('./securityAxiomReadOnlyProvider');

function asDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  if (Number.isNaN(date.getTime())) throw new Error('invalid date');
  return date;
}

class ReadOnlySecuritySource {
  constructor({
    fetchEvents,
    pipeline = new ShadowSecurityPipeline(),
    enabled = false,
    environment = 'unknown',
    initialLookbackMs = 5 * 60 * 1000,
    overlapMs = 30 * 1000,
    heartbeatTimeoutMs = 10 * 60 * 1000,
    maxBatchSize = 500
  } = {}) {
    if (typeof fetchEvents !== 'function') throw new TypeError('fetchEvents must be a function');
    if (!(pipeline instanceof ShadowSecurityPipeline)) {
      throw new TypeError('pipeline must be a ShadowSecurityPipeline');
    }
    if (!Number.isInteger(initialLookbackMs) || initialLookbackMs < 1000) {
      throw new Error('initialLookbackMs must be an integer >= 1000');
    }
    if (!Number.isInteger(overlapMs) || overlapMs < 0 || overlapMs > initialLookbackMs) {
      throw new Error('overlapMs must be an integer between 0 and initialLookbackMs');
    }
    if (!Number.isInteger(heartbeatTimeoutMs) || heartbeatTimeoutMs < 60 * 1000) {
      throw new Error('heartbeatTimeoutMs must be an integer >= 60000');
    }
    if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > 5000) {
      throw new Error('maxBatchSize must be an integer between 1 and 5000');
    }

    this.fetchEvents = fetchEvents;
    this.pipeline = pipeline;
    this.enabled = enabled === true;
    this.environment = String(environment || 'unknown').slice(0, 64);
    this.initialLookbackMs = initialLookbackMs;
    this.overlapMs = overlapMs;
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
    this.maxBatchSize = maxBatchSize;

    this.watermark = null;
    this.lastPollStartedAt = null;
    this.lastSuccessAt = null;
    this.lastFailureAt = null;
    this.consecutiveFailures = 0;
    this.totalPolls = 0;
    this.totalFetched = 0;
    this.totalAccepted = 0;
    this.totalDuplicates = 0;
  }

  async poll({ now = new Date() } = {}) {
    const pollTime = asDate(now);

    if (!this.enabled) {
      return {
        status: 'disabled',
        fetched: 0,
        accepted: 0,
        duplicates: 0,
        watermark: this.watermark
      };
    }

    this.lastPollStartedAt = pollTime.toISOString();
    this.totalPolls += 1;

    const startTime = this.watermark
      ? new Date(new Date(this.watermark).getTime() - this.overlapMs)
      : new Date(pollTime.getTime() - this.initialLookbackMs);

    try {
      const records = await this.fetchEvents({
        startTime,
        endTime: pollTime,
        limit: this.maxBatchSize
      });

      if (!Array.isArray(records)) {
        throw new TypeError('fetchEvents must resolve to an array');
      }

      const sorted = records
        .slice(0, this.maxBatchSize)
        .sort((a, b) => this.#recordTime(a) - this.#recordTime(b));

      const result = await this.pipeline.ingestLegacySecurityRecords(sorted, {
        now: pollTime,
        environment: this.environment
      });

      const newest = sorted.reduce((latest, record) => {
        const time = this.#recordTime(record);
        return Number.isFinite(time) && time > latest ? time : latest;
      }, this.watermark ? new Date(this.watermark).getTime() : Number.NEGATIVE_INFINITY);

      if (Number.isFinite(newest)) {
        this.watermark = new Date(newest).toISOString();
      } else if (!this.watermark) {
        this.watermark = pollTime.toISOString();
      }

      this.lastSuccessAt = pollTime.toISOString();
      this.consecutiveFailures = 0;
      this.totalFetched += sorted.length;
      this.totalAccepted += result.acceptedCount;
      this.totalDuplicates += result.duplicateCount;

      return {
        status: 'ok',
        fetched: sorted.length,
        accepted: result.acceptedCount,
        duplicates: result.duplicateCount,
        findings: result.findings,
        incidents: result.incidents,
        watermark: this.watermark
      };
    } catch (error) {
      this.lastFailureAt = pollTime.toISOString();
      this.consecutiveFailures += 1;
      return {
        status: 'error',
        errorCode: 'SECURITY_SOURCE_POLL_FAILED',
        fetched: 0,
        accepted: 0,
        duplicates: 0,
        watermark: this.watermark
      };
    }
  }

  async checkHeartbeat({ now = new Date() } = {}) {
    const checkTime = asDate(now);

    if (!this.enabled) {
      return { status: 'disabled', incidentCreated: false };
    }

    const reference = this.lastSuccessAt || this.lastPollStartedAt;
    if (!reference) {
      return { status: 'not_started', incidentCreated: false };
    }

    const ageMs = checkTime.getTime() - new Date(reference).getTime();
    if (ageMs < this.heartbeatTimeoutMs) {
      return { status: 'healthy', ageMs, incidentCreated: false };
    }

    const bucket = Math.floor(checkTime.getTime() / this.heartbeatTimeoutMs);
    const eventId = `source-heartbeat:${crypto.createHash('sha256')
      .update(`${this.environment}:${bucket}`)
      .digest('hex')
      .slice(0, 24)}`;

    const result = await this.pipeline.ingest({
      eventId,
      timestamp: checkTime.toISOString(),
      source: 'demos.axiom_security_source',
      type: 'heartbeat.missed',
      category: 'telemetry',
      severity: 'high',
      environment: this.environment,
      asset: 'security-telemetry',
      meta: {
        ageSeconds: Math.floor(ageMs / 1000),
        failureCount: this.consecutiveFailures
      }
    }, { now: checkTime });

    return {
      status: 'stale',
      ageMs,
      incidentCreated: result.incidents.some(incident => incident.ruleId === 'DET-TELEMETRY-GAP')
    };
  }

  status() {
    return {
      enabled: this.enabled,
      watermark: this.watermark,
      lastPollStartedAt: this.lastPollStartedAt,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      consecutiveFailures: this.consecutiveFailures,
      totals: {
        polls: this.totalPolls,
        fetched: this.totalFetched,
        accepted: this.totalAccepted,
        duplicates: this.totalDuplicates
      }
    };
  }

  #recordTime(record) {
    const value = record?._time || record?.created_at || record?.timestamp;
    const parsed = value ? new Date(value).getTime() : Number.NaN;
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }
}

function createAxiomReadOnlySecuritySource({
  pipeline,
  fetchSecurityEvents,
  env = process.env,
  ...options
} = {}) {
  let fetcher = fetchSecurityEvents;
  if (!fetcher) {
    const provider = createSecurityAxiomReadOnlyProvider({ env });
    fetcher = provider
      ? value => provider.getSecurityEvents(value)
      : async () => {
          const error = new Error('SECURITY_AXIOM_PROVIDER_NOT_READY');
          error.code = 'SECURITY_AXIOM_PROVIDER_NOT_READY';
          throw error;
        };
  }
  const enabled = env.SECURITY_AGENT_SHADOW_ENABLED === 'true';

  return new ReadOnlySecuritySource({
    ...options,
    pipeline,
    fetchEvents: fetcher,
    enabled,
    environment: env.SECURITY_AGENT_ENVIRONMENT_CLASS || env.NODE_ENV || 'unknown'
  });
}

module.exports = {
  ReadOnlySecuritySource,
  createAxiomReadOnlySecuritySource
};
