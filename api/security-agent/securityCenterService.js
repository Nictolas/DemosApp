const { buildSecurityCenterOverview, pickIncident } = require('./securityCenterReadModel');

const ALLOWED_STATUSES = new Set(['open', 'acknowledged', 'resolved']);
const ALLOWED_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);

function validateOptionalFilter(value, allowed, name) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).toLowerCase();
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}`);
  return normalized;
}

function validateLimit(value, fallback = 100) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) throw new Error('invalid limit');
  return parsed;
}

class SecurityCenterService {
  constructor({ runner, store, sourceName = 'axiom-security', staleAfterMs = 10 * 60 * 1000 } = {}) {
    if (!runner || typeof runner.status !== 'function') throw new TypeError('runner.status() is required');
    if (!store || typeof store.listIncidents !== 'function' || typeof store.stats !== 'function' || typeof store.getSourceState !== 'function') {
      throw new TypeError('store read contract is required');
    }
    this.runner = runner;
    this.store = store;
    this.sourceName = String(sourceName || 'axiom-security').slice(0, 80);
    this.staleAfterMs = staleAfterMs;
  }

  getOverview({ now = new Date(), recentLimit = 10 } = {}) {
    const incidents = this.store.listIncidents({ limit: Math.max(100, recentLimit) });
    return buildSecurityCenterOverview({
      runnerStatus: this.runner.status(),
      sourceState: this.store.getSourceState(this.sourceName),
      storeStats: this.store.stats(),
      incidents,
      now,
      staleAfterMs: this.staleAfterMs,
      recentLimit
    });
  }

  listIncidents({ status, severity, limit } = {}) {
    const safeStatus = validateOptionalFilter(status, ALLOWED_STATUSES, 'status');
    const safeSeverity = validateOptionalFilter(severity, ALLOWED_SEVERITIES, 'severity');
    const safeLimit = validateLimit(limit, 100);
    return this.store
      .listIncidents({ status: safeStatus, severity: safeSeverity, limit: safeLimit })
      .map(pickIncident);
  }

  getHealth({ now = new Date() } = {}) {
    const overview = this.getOverview({ now, recentLimit: 1 });
    return {
      generatedAt: overview.generatedAt,
      shield: overview.shield,
      agent: overview.agent,
      telemetry: overview.telemetry,
      openIncidentCount: overview.incidents.open,
      highestOpenSeverity: overview.incidents.highestOpenSeverity
    };
  }
}

module.exports = {
  SecurityCenterService,
  validateLimit,
  validateOptionalFilter
};
