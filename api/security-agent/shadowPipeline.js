const { SecurityCollector } = require('./securityCollector');
const { DetectionEngine } = require('./detectionEngine');
const { IncidentManager } = require('./incidentManager');
const { normalizeSecurityEvent } = require('./securityEvent');
const { adaptLegacySecurityRecord, adaptLegacyViolation } = require('./legacyAdapters');

class ShadowSecurityPipeline {
  constructor({
    collector = new SecurityCollector(),
    detectionEngine = new DetectionEngine(),
    incidentManager = new IncidentManager(),
    maxSeenEventIds = 5000
  } = {}) {
    if (!Number.isInteger(maxSeenEventIds) || maxSeenEventIds < 100 || maxSeenEventIds > 50000) {
      throw new Error('maxSeenEventIds must be an integer between 100 and 50000');
    }

    this.collector = collector;
    this.detectionEngine = detectionEngine;
    this.incidentManager = incidentManager;
    this.maxSeenEventIds = maxSeenEventIds;
    this.seenEventIds = new Set();
    this.seenOrder = [];
  }

  async ingest(input, { now = new Date() } = {}) {
    const normalized = normalizeSecurityEvent(input, now);
    if (!this.#remember(normalized.eventId)) {
      return {
        accepted: false,
        duplicate: true,
        event: null,
        findings: [],
        incidents: []
      };
    }

    const event = await this.collector.collect(normalized);
    const { findings, incidents } = this.evaluate(now);

    return {
      accepted: true,
      duplicate: false,
      event,
      findings,
      incidents
    };
  }

  async ingestMany(inputs, { adapter = null, now = new Date() } = {}) {
    if (!Array.isArray(inputs)) throw new TypeError('inputs must be an array');
    if (adapter !== null && typeof adapter !== 'function') {
      throw new TypeError('adapter must be a function or null');
    }

    let acceptedCount = 0;
    let duplicateCount = 0;

    for (const input of inputs) {
      const candidate = adapter ? adapter(input, { now }) : input;
      const normalized = normalizeSecurityEvent(candidate, now);

      if (!this.#remember(normalized.eventId)) {
        duplicateCount += 1;
        continue;
      }

      await this.collector.collect(normalized);
      acceptedCount += 1;
    }

    const { findings, incidents } = this.evaluate(now);
    return {
      acceptedCount,
      duplicateCount,
      findings,
      incidents
    };
  }

  ingestLegacySecurityRecords(records, options = {}) {
    return this.ingestMany(records, {
      ...options,
      adapter: adaptLegacySecurityRecord
    });
  }

  ingestLegacyViolations(violations, options = {}) {
    return this.ingestMany(violations, {
      ...options,
      adapter: adaptLegacyViolation
    });
  }

  evaluate(now = new Date()) {
    const findings = this.detectionEngine.evaluate(this.collector.snapshot(), now);
    const incidents = this.incidentManager.ingest(findings, now);
    return { findings, incidents };
  }

  snapshot() {
    return {
      events: this.collector.snapshot(),
      incidents: this.incidentManager.list()
    };
  }

  #remember(eventId) {
    if (this.seenEventIds.has(eventId)) return false;

    this.seenEventIds.add(eventId);
    this.seenOrder.push(eventId);

    while (this.seenOrder.length > this.maxSeenEventIds) {
      const expired = this.seenOrder.shift();
      this.seenEventIds.delete(expired);
    }

    return true;
  }
}

module.exports = { ShadowSecurityPipeline };
