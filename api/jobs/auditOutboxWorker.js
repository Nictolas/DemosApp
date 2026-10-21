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
  intervalMs = 60000
}) {
  if (!outbox || typeof outbox.drainOnce !== 'function') {
    throw new Error('AUDIT_OUTBOX_WORKER_INVALID_DEPENDENCY');
  }
  let timer = null;
  let running = false;

  async function runOnce() {
    if (!enabled()) return { skipped: true, reason: 'disabled' };
    if (running) return { skipped: true, reason: 'already-running' };
    running = true;
    try {
      const result = await outbox.drainOnce({ limit: 10 });
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
  const AuditService = require('../services/auditService');
  return createAuditOutboxWorker({ outbox: AuditService.getAuditOutbox() }).start();
}

module.exports = { createAuditOutboxWorker, startProductionWorker };
