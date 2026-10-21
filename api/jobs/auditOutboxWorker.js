'use strict';

// Fail-closed scheduler: no work begins unless BOTH feature gates are enabled.
// Designed for a single Node instance, with row leases protecting extra workers.
function createAuditOutboxWorker({
  outbox,
  enabled = () => process.env.AUDIT_OUTBOX_ENABLED === 'true'
    && process.env.AUDIT_OUTBOX_WORKER_ENABLED === 'true',
  schedule = setInterval,
  unschedule = clearInterval,
  report = console.warn,
  notifyAdmin = null,
  clock = () => Date.now(),
  intervalMs = 60000,
  alertCooldownMs = 60 * 60 * 1000
}) {
  if (!outbox || typeof outbox.drainOnce !== 'function') {
    throw new Error('AUDIT_OUTBOX_WORKER_INVALID_DEPENDENCY');
  }
  let timer = null;
  let running = false;
  let lastHealthAlertMs = -Infinity;
  let lastNotificationMs = -Infinity;
  let lastNotificationKind = null;
  let lastNotificationSucceeded = false;

  async function alertAdmins(kind) {
    if (typeof notifyAdmin !== 'function') return;
    if (lastNotificationKind !== kind) {
      lastNotificationMs = -Infinity;
      lastNotificationSucceeded = false;
    }
    const retryAfterMs = lastNotificationSucceeded ? alertCooldownMs : 5 * 60 * 1000;
    if (clock() - lastNotificationMs < retryAfterMs) return;
    lastNotificationKind = kind;
    lastNotificationMs = clock();
    try {
      const result = await notifyAdmin(kind);
      lastNotificationSucceeded = result?.success === true;
      if (!lastNotificationSucceeded) report('AUDIT_OUTBOX_ADMIN_ALERT_UNDELIVERED');
    } catch (_error) {
      lastNotificationSucceeded = false;
      report('AUDIT_OUTBOX_ADMIN_ALERT_UNDELIVERED');
    }
  }

  async function checkHealth() {
    if (typeof outbox.getHealth !== 'function') return;
    try {
      const health = await outbox.getHealth();
      // Operating thresholds, NOT legal retention periods.
      const unhealthy = health.total >= Math.ceil(health.capacity * 0.8) ||
        health.deadLetter > 0 || health.oldestWaitSeconds >= 15 * 60;
      // Prefer the most actionable code; only the fixed code leaves the worker.
      const alertKind = health.deadLetter > 0 ? 'AUDIT_OUTBOX_DEAD_LETTER'
        : health.total >= Math.ceil(health.capacity * 0.8) ? 'AUDIT_OUTBOX_CAPACITY_PRESSURE'
          : 'AUDIT_OUTBOX_DELIVERY_DELAY';
      if (unhealthy && clock() - lastHealthAlertMs >= alertCooldownMs) {
        // Only aggregate counts/age. Never print event bodies or DB errors.
        report('AUDIT_OUTBOX_HEALTH_WARNING', health);
        lastHealthAlertMs = clock();
      }
      if (unhealthy) await alertAdmins(alertKind);
      if (!unhealthy) {
        lastHealthAlertMs = -Infinity;
        lastNotificationMs = -Infinity;
        lastNotificationKind = null;
        lastNotificationSucceeded = false;
      }
    } catch (_error) {
      if (clock() - lastHealthAlertMs >= alertCooldownMs) {
        report('AUDIT_OUTBOX_HEALTH_CHECK_FAILED');
        lastHealthAlertMs = clock();
      }
      await alertAdmins('AUDIT_OUTBOX_HEALTH_CHECK_FAILED');
    }
  }

  async function runOnce() {
    if (!enabled()) return { skipped: true, reason: 'disabled' };
    if (running) return { skipped: true, reason: 'already-running' };
    running = true;
    try {
      const result = await outbox.drainOnce({ limit: 10 });
      await checkHealth();
      // Counts only. Never print event bodies, user IDs or full provider errors.
      if (result.delivered || result.rescheduled || result.deadLettered) {
        report('AUDIT_OUTBOX_DELIVERY_METRICS', {
          delivered: result.delivered,
          rescheduled: result.rescheduled,
          deadLettered: result.deadLettered
        });
      }
      return result;
    } catch (_error) {
      report('AUDIT_OUTBOX_WORKER_FAILED');
      await alertAdmins('AUDIT_OUTBOX_WORKER_FAILED');
      return { failed: true };
    } finally {
      running = false;
    }
  }

  function start() {
    if (!enabled()) return null;
    if (timer) return timer;
    if (!Number.isSafeInteger(intervalMs) || intervalMs < 5000) {
      throw new Error('AUDIT_OUTBOX_WORKER_INVALID_INTERVAL');
    }
    timer = schedule(() => { void runOnce(); }, intervalMs);
    if (process.env.AUDIT_OUTBOX_RUN_ON_START === 'true') {
      setImmediate(() => { void runOnce(); });
    }
    report('AUDIT_OUTBOX_WORKER_STARTED');
    return timer;
  }

  function stop() {
    if (timer) unschedule(timer);
    timer = null;
  }

  return { start, stop, runOnce };
}

function startProductionWorker() {
  if (process.env.AUDIT_OUTBOX_ENABLED !== 'true' ||
      process.env.AUDIT_OUTBOX_WORKER_ENABLED !== 'true') return null;
  // Lazy load: avoids DB connectivity when the feature is disabled.
  // A missing dedicated DB URL must not take the rest of DEMOS offline.
  try {
    const AuditService = require('../services/auditService');
    const { createProductionOutboxNotifier } = require('../services/auditOutboxAlertService');
    return createAuditOutboxWorker({
      outbox: AuditService.getAuditOutbox(),
      notifyAdmin: createProductionOutboxNotifier()
    }).start();
  } catch (_error) {
    console.warn('AUDIT_OUTBOX_WORKER_CONFIGURATION_REJECTED');
    return null;
  }
}

module.exports = { createAuditOutboxWorker, startProductionWorker };
