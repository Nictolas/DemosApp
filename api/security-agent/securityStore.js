const ALLOWED_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const ALLOWED_STATUSES = new Set(['open', 'acknowledged', 'resolved']);
const MAX_ID_LENGTH = 160;
const DEFAULT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function cleanString(value, max = MAX_ID_LENGTH) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

function cleanDate(value, fallback) {
  const date = value ? new Date(value) : new Date(fallback);
  if (Number.isNaN(date.getTime())) throw new Error('invalid store timestamp');
  return date.toISOString();
}

function sanitizeIncidentForStore(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('incident must be an object');
  }

  const severity = cleanString(input.severity || 'info').toLowerCase();
  const status = cleanString(input.status || 'open').toLowerCase();
  if (!ALLOWED_SEVERITIES.has(severity)) throw new Error('invalid incident severity');
  if (!ALLOWED_STATUSES.has(status)) throw new Error('invalid incident status');

  const incidentId = cleanString(input.incidentId);
  const ruleId = cleanString(input.ruleId);
  const findingId = cleanString(input.findingId);
  if (!incidentId || !ruleId || !findingId) {
    throw new Error('incidentId, ruleId and findingId are required');
  }

  const count = Number(input.count ?? 1);
  if (!Number.isFinite(count) || count < 0) throw new Error('invalid incident count');

  return Object.freeze({
    incidentId,
    findingId,
    ruleId,
    severity,
    status,
    count: Math.floor(count),
    firstSeen: cleanDate(input.firstSeen, now),
    lastSeen: cleanDate(input.lastSeen, now),
    createdAt: cleanDate(input.createdAt, now),
    updatedAt: cleanDate(input.updatedAt, now)
  });
}

function sanitizeSourceState(input = {}, now = new Date()) {
  const totals = input?.totals && typeof input.totals === 'object' ? input.totals : {};
  const number = value => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  };

  const optionalDate = value => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  return Object.freeze({
    enabled: input.enabled === true,
    watermark: optionalDate(input.watermark),
    lastPollStartedAt: optionalDate(input.lastPollStartedAt),
    lastSuccessAt: optionalDate(input.lastSuccessAt),
    lastFailureAt: optionalDate(input.lastFailureAt),
    consecutiveFailures: number(input.consecutiveFailures),
    totals: Object.freeze({
      polls: number(totals.polls),
      fetched: number(totals.fetched),
      accepted: number(totals.accepted),
      duplicates: number(totals.duplicates)
    }),
    storedAt: new Date(now).toISOString()
  });
}

class MemorySecurityStore {
  constructor({ retentionMs = DEFAULT_RETENTION_MS, maxIncidents = 10000 } = {}) {
    if (!Number.isInteger(retentionMs) || retentionMs < 60 * 60 * 1000) {
      throw new Error('retentionMs must be an integer >= 3600000');
    }
    if (!Number.isInteger(maxIncidents) || maxIncidents < 1 || maxIncidents > 100000) {
      throw new Error('maxIncidents must be an integer between 1 and 100000');
    }
    this.retentionMs = retentionMs;
    this.maxIncidents = maxIncidents;
    this.incidents = new Map();
    this.sourceStates = new Map();
  }

  upsertIncidents(inputs, now = new Date()) {
    if (!Array.isArray(inputs)) throw new TypeError('incidents must be an array');
    const stored = [];
    for (const input of inputs) {
      const incident = sanitizeIncidentForStore(input, now);
      this.incidents.set(incident.incidentId, incident);
      stored.push({ ...incident });
    }
    this.#enforceMax();
    return stored;
  }

  listIncidents({ status, severity, limit = 100 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('limit must be an integer between 1 and 1000');
    }
    return Array.from(this.incidents.values())
      .filter(item => !status || item.status === status)
      .filter(item => !severity || item.severity === severity)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map(item => ({ ...item }));
  }

  saveSourceState(sourceName, state, now = new Date()) {
    const name = cleanString(sourceName, 80);
    if (!name) throw new Error('sourceName is required');
    const sanitized = sanitizeSourceState(state, now);
    this.sourceStates.set(name, sanitized);
    return { ...sanitized, totals: { ...sanitized.totals } };
  }

  getSourceState(sourceName) {
    const state = this.sourceStates.get(cleanString(sourceName, 80));
    return state ? { ...state, totals: { ...state.totals } } : null;
  }

  prune({ now = new Date() } = {}) {
    const threshold = new Date(now).getTime() - this.retentionMs;
    let removed = 0;
    for (const [id, incident] of this.incidents.entries()) {
      const updated = new Date(incident.updatedAt).getTime();
      if (Number.isFinite(updated) && updated < threshold) {
        this.incidents.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  stats() {
    const incidents = Array.from(this.incidents.values());
    const bySeverity = {};
    const byStatus = {};
    for (const incident of incidents) {
      bySeverity[incident.severity] = (bySeverity[incident.severity] || 0) + 1;
      byStatus[incident.status] = (byStatus[incident.status] || 0) + 1;
    }
    return {
      incidentCount: incidents.length,
      sourceCount: this.sourceStates.size,
      bySeverity,
      byStatus
    };
  }

  #enforceMax() {
    if (this.incidents.size <= this.maxIncidents) return;
    const oldest = Array.from(this.incidents.values())
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    while (this.incidents.size > this.maxIncidents && oldest.length) {
      this.incidents.delete(oldest.shift().incidentId);
    }
  }
}

module.exports = {
  DEFAULT_RETENTION_MS,
  MemorySecurityStore,
  sanitizeIncidentForStore,
  sanitizeSourceState
};
