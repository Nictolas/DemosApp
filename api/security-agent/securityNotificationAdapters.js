const NOTIFICATION_CONTRACT_VERSION = 'v0.13';

const EXTERNAL_CHANNELS = Object.freeze(['push', 'email', 'external_secondary']);
const INTERNAL_CHANNELS = Object.freeze(['security_center', 'summary']);
const ALL_CHANNELS = new Set([...EXTERNAL_CHANNELS, ...INTERNAL_CHANNELS]);

function safeToken(value, fallback = 'unknown', max = 96) {
  const text = String(value ?? fallback).replace(/[^A-Za-z0-9_.:|\-]/g, '_');
  return (text || fallback).slice(0, max);
}

function safeIso(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback).toISOString() : date.toISOString();
}

function sanitizeNotificationTask(input = {}) {
  const channel = safeToken(input.channel, 'unknown', 32);
  if (!ALL_CHANNELS.has(channel)) {
    throw new Error('unsupported notification channel');
  }

  const priority = ['P0', 'P1', 'P2', 'P3'].includes(input.priority) ? input.priority : 'P3';
  const decision = safeToken(input.decision, 'route_simulated', 40);
  const task = {
    contractVersion: NOTIFICATION_CONTRACT_VERSION,
    channel,
    fingerprint: safeToken(input.fingerprint, 'unknown', 240),
    priority,
    code: safeToken(input.code, 'UNKNOWN_ALERT', 80),
    scope: safeToken(input.scope, 'unknown', 48),
    state: input.state == null ? null : safeToken(input.state, 'unknown', 32),
    decision,
    createdAt: safeIso(input.createdAt)
  };

  return Object.freeze(task);
}

function sanitizeAuditRecord(input = {}) {
  return Object.freeze({
    contractVersion: NOTIFICATION_CONTRACT_VERSION,
    channel: safeToken(input.channel, 'unknown', 32),
    fingerprint: safeToken(input.fingerprint, 'unknown', 240),
    priority: ['P0', 'P1', 'P2', 'P3'].includes(input.priority) ? input.priority : 'P3',
    code: safeToken(input.code, 'UNKNOWN_ALERT', 80),
    decision: safeToken(input.decision, 'unknown', 40),
    outcome: safeToken(input.outcome, 'unknown', 40),
    adapter: safeToken(input.adapter, 'none', 48),
    occurredAt: safeIso(input.occurredAt)
  });
}

class MemoryNotificationAudit {
  constructor({ maxRecords = 500 } = {}) {
    this.maxRecords = Number.isInteger(maxRecords) && maxRecords > 0 ? maxRecords : 500;
    this.records = [];
  }

  append(record) {
    const sanitized = sanitizeAuditRecord(record);
    this.records.push(sanitized);
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
    return sanitized;
  }

  list() {
    return Object.freeze([...this.records]);
  }
}

function createNoopNotificationAdapter(channel) {
  if (!EXTERNAL_CHANNELS.includes(channel)) throw new Error('invalid noop adapter channel');
  return Object.freeze({
    name: `noop_${channel}`,
    channel,
    simulated: true,
    async send(task) {
      const sanitized = sanitizeNotificationTask({ ...task, channel });
      return Object.freeze({
        delivered: false,
        simulated: true,
        outcome: 'simulated_noop',
        channel,
        fingerprint: sanitized.fingerprint
      });
    }
  });
}

function buildDefaultNoopAdapters() {
  return Object.freeze(Object.fromEntries(
    EXTERNAL_CHANNELS.map(channel => [channel, createNoopNotificationAdapter(channel)])
  ));
}

class NotificationDispatcher {
  constructor({ adapters = buildDefaultNoopAdapters(), audit = new MemoryNotificationAudit(), allowRealDelivery = false } = {}) {
    this.adapters = adapters && typeof adapters === 'object' ? adapters : {};
    this.audit = audit;
    this.allowRealDelivery = allowRealDelivery === true;
  }

  async dispatchRoutingPlan(plan = {}) {
    const routes = Array.isArray(plan.routes) ? plan.routes : [];
    const results = [];

    for (const route of routes) {
      const channels = Array.isArray(route?.channels) ? route.channels : [];
      for (const channel of channels) {
        results.push(await this.#dispatchChannel(route, channel));
      }
    }

    return Object.freeze({
      contractVersion: NOTIFICATION_CONTRACT_VERSION,
      simulated: !this.allowRealDelivery,
      results: Object.freeze(results),
      auditCount: this.audit.list().length
    });
  }

  async #dispatchChannel(route = {}, channel) {
    const task = sanitizeNotificationTask({
      channel,
      fingerprint: route.fingerprint,
      priority: route.priority,
      code: route.code,
      scope: route.scope,
      state: route.state,
      decision: route.decision
    });

    if (INTERNAL_CHANNELS.includes(channel)) {
      return this.#record(task, 'internal_only', 'internal');
    }

    const adapter = this.adapters[channel];
    if (!adapter || typeof adapter.send !== 'function') {
      return this.#record(task, 'missing_adapter_fail_closed', 'none');
    }

    if (adapter.channel !== channel) {
      return this.#record(task, 'adapter_channel_mismatch', safeToken(adapter.name, 'unknown'));
    }

    if (!this.allowRealDelivery && adapter.simulated !== true) {
      return this.#record(task, 'real_adapter_blocked', safeToken(adapter.name, 'unknown'));
    }

    try {
      const result = await adapter.send(task);
      const outcome = result?.delivered === true
        ? (this.allowRealDelivery ? 'delivered' : 'delivery_blocked')
        : safeToken(result?.outcome, 'not_delivered', 40);
      return this.#record(task, outcome, safeToken(adapter.name, 'unknown'));
    } catch (_error) {
      return this.#record(task, 'adapter_error_fail_closed', safeToken(adapter.name, 'unknown'));
    }
  }

  #record(task, outcome, adapter) {
    const auditRecord = this.audit.append({
      channel: task.channel,
      fingerprint: task.fingerprint,
      priority: task.priority,
      code: task.code,
      decision: task.decision,
      outcome,
      adapter
    });

    return Object.freeze({
      channel: auditRecord.channel,
      fingerprint: auditRecord.fingerprint,
      outcome: auditRecord.outcome,
      adapter: auditRecord.adapter
    });
  }
}

module.exports = {
  NOTIFICATION_CONTRACT_VERSION,
  EXTERNAL_CHANNELS,
  INTERNAL_CHANNELS,
  sanitizeNotificationTask,
  sanitizeAuditRecord,
  MemoryNotificationAudit,
  createNoopNotificationAdapter,
  buildDefaultNoopAdapters,
  NotificationDispatcher
};
