const { buildAlertRoutingPlan } = require('./securityAlertRouting');
const { NotificationDispatcher } = require('./securityNotificationAdapters');

const NOTIFICATION_SIMULATION_VERSION = 'v0.14';
const PRIORITY_RANK = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

function validateAuditLimit(value, fallback = 50) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) throw new Error('invalid notification audit limit');
  return parsed;
}

function emptyNotificationSimulationStatus() {
  return Object.freeze({
    version: NOTIFICATION_SIMULATION_VERSION,
    state: 'never',
    simulated: true,
    lastRunAt: null,
    runCount: 0,
    routeCount: 0,
    dispatchCount: 0,
    auditCount: 0,
    highestPriority: null,
    byChannel: Object.freeze({}),
    byOutcome: Object.freeze({})
  });
}

function countBy(results, key) {
  const counts = {};
  for (const result of Array.isArray(results) ? results : []) {
    const value = String(result?.[key] || 'unknown').slice(0, 64);
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.freeze(counts);
}

class SecurityNotificationSimulation {
  constructor({ dispatcher = new NotificationDispatcher() } = {}) {
    if (!dispatcher || typeof dispatcher.dispatchRoutingPlan !== 'function') {
      throw new TypeError('notification dispatcher contract is required');
    }
    if (!dispatcher.audit || typeof dispatcher.audit.list !== 'function') {
      throw new TypeError('notification audit read contract is required');
    }
    if (dispatcher.allowRealDelivery === true) {
      throw new Error('notification simulation cannot allow real delivery');
    }
    this.dispatcher = dispatcher;
    this.routingState = {};
    this.lastRun = null;
    this.runCount = 0;
  }

  async simulate({ alerts = [], now = new Date() } = {}) {
    const plan = buildAlertRoutingPlan({ alerts, routingState: this.routingState, now });
    if (plan.simulated !== true) throw new Error('routing plan must remain simulated');

    const dispatch = await this.dispatcher.dispatchRoutingPlan(plan);
    if (dispatch.simulated !== true) throw new Error('notification dispatcher must remain simulated');

    this.routingState = plan.state;
    this.runCount += 1;

    const priorities = plan.routes
      .map(route => route.priority)
      .filter(priority => Object.prototype.hasOwnProperty.call(PRIORITY_RANK, priority))
      .sort((a, b) => PRIORITY_RANK[a] - PRIORITY_RANK[b]);

    this.lastRun = Object.freeze({
      version: NOTIFICATION_SIMULATION_VERSION,
      state: 'simulated',
      simulated: true,
      lastRunAt: plan.generatedAt,
      runCount: this.runCount,
      routeCount: plan.routes.length,
      dispatchCount: dispatch.results.length,
      auditCount: dispatch.auditCount,
      highestPriority: priorities[0] || null,
      byChannel: countBy(dispatch.results, 'channel'),
      byOutcome: countBy(dispatch.results, 'outcome')
    });

    return Object.freeze({
      status: this.status(),
      results: Object.freeze(dispatch.results.map(result => Object.freeze({ ...result })))
    });
  }

  status() {
    if (!this.lastRun) return emptyNotificationSimulationStatus();
    return Object.freeze({
      ...this.lastRun,
      byChannel: Object.freeze({ ...this.lastRun.byChannel }),
      byOutcome: Object.freeze({ ...this.lastRun.byOutcome })
    });
  }

  listAudit({ limit = 50 } = {}) {
    const safeLimit = validateAuditLimit(limit, 50);
    const records = this.dispatcher.audit.list();
    return Object.freeze(records
      .slice(-safeLimit)
      .reverse()
      .map(record => Object.freeze({ ...record })));
  }
}

module.exports = {
  NOTIFICATION_SIMULATION_VERSION,
  validateAuditLimit,
  emptyNotificationSimulationStatus,
  SecurityNotificationSimulation
};
