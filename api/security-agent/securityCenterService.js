const { buildSecurityCenterOverview, pickIncident } = require('./securityCenterReadModel');
const { emptyNotificationSimulationStatus } = require('./securityNotificationSimulation');

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
  constructor({ runner, runtime = null, store, notificationSimulation = null, sourceName = 'axiom-security', staleAfterMs = 10 * 60 * 1000 } = {}) {
    if (!runner || typeof runner.status !== 'function') throw new TypeError('runner.status() is required');
    if (runtime !== null && (!runtime || typeof runtime.status !== 'function')) throw new TypeError('runtime.status() is required when runtime is provided');
    if (!store || typeof store.listIncidents !== 'function' || typeof store.stats !== 'function' || typeof store.getSourceState !== 'function') {
      throw new TypeError('store read contract is required');
    }
    if (notificationSimulation !== null && (
      !notificationSimulation ||
      typeof notificationSimulation.status !== 'function' ||
      typeof notificationSimulation.listAudit !== 'function'
    )) {
      throw new TypeError('notification simulation read contract is required when provided');
    }
    this.runner = runner;
    this.runtime = runtime;
    this.store = store;
    this.notificationSimulation = notificationSimulation;
    this.sourceName = String(sourceName || 'axiom-security').slice(0, 80);
    this.staleAfterMs = staleAfterMs;
  }

  async getOverview({ now = new Date(), recentLimit = 10 } = {}) {
    const [incidents, sourceState, storeStats] = await Promise.all([
      this.store.listIncidents({ limit: Math.max(100, recentLimit) }),
      this.store.getSourceState(this.sourceName),
      this.store.stats()
    ]);

    const overview = buildSecurityCenterOverview({
      runnerStatus: this.runner.status(),
      runtimeStatus: this.runtime ? this.runtime.status() : null,
      sourceState,
      storeStats,
      incidents,
      now,
      staleAfterMs: this.staleAfterMs,
      recentLimit
    });

    const notificationStatus = this.notificationSimulation
      ? this.notificationSimulation.status()
      : emptyNotificationSimulationStatus();
    const recentNotificationAudit = this.notificationSimulation
      ? this.notificationSimulation.listAudit({ limit: 10 })
      : [];

    return {
      ...overview,
      notifications: {
        status: notificationStatus,
        recentAudit: recentNotificationAudit
      }
    };
  }

  async listIncidents({ status, severity, limit } = {}) {
    const safeStatus = validateOptionalFilter(status, ALLOWED_STATUSES, 'status');
    const safeSeverity = validateOptionalFilter(severity, ALLOWED_SEVERITIES, 'severity');
    const safeLimit = validateLimit(limit, 100);
    const incidents = await this.store.listIncidents({ status: safeStatus, severity: safeSeverity, limit: safeLimit });
    return incidents.map(pickIncident);
  }

  async getNotifications({ limit } = {}) {
    const safeLimit = validateLimit(limit, 50);
    if (!this.notificationSimulation) {
      return { status: emptyNotificationSimulationStatus(), audit: [] };
    }
    return {
      status: this.notificationSimulation.status(),
      audit: this.notificationSimulation.listAudit({ limit: safeLimit })
    };
  }

  async getHealth({ now = new Date() } = {}) {
    const overview = await this.getOverview({ now, recentLimit: 1 });
    return {
      generatedAt: overview.generatedAt,
      shield: overview.shield,
      health: overview.health,
      alerts: overview.alerts,
      agent: overview.agent,
      telemetry: overview.telemetry,
      notifications: overview.notifications.status,
      openIncidentCount: overview.incidents.open,
      highestOpenSeverity: overview.incidents.highestOpenSeverity
    };
  }
}

module.exports = { SecurityCenterService, validateLimit, validateOptionalFilter };
