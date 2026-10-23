'use strict';

// Small, privacy-bounded bridge to DEMOS's existing admin notification service.
// The bridge is inert unless separately enabled; never sends event payloads,
// personal identifiers, query strings or provider exception messages.
const ALERT_TYPES = Object.freeze({
  AUDIT_OUTBOX_DEAD_LETTER: 'CRITICAL',
  AUDIT_OUTBOX_CAPACITY_PRESSURE: 'HIGH',
  AUDIT_OUTBOX_DELIVERY_DELAY: 'HIGH',
  AUDIT_OUTBOX_HEALTH_CHECK_FAILED: 'CRITICAL',
  AUDIT_OUTBOX_WORKER_FAILED: 'CRITICAL'
});

function createOutboxAdminNotifier({
  sendAlert,
  enabled = () => process.env.AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED === 'true'
}) {
  if (typeof sendAlert !== 'function' || typeof enabled !== 'function') {
    throw new Error('OUTBOX_ALERT_INVALID_DEPENDENCY');
  }

  return async function notifyOutboxAdmin(kind) {
    if (!Object.hasOwn(ALERT_TYPES, kind)) {
      throw new Error('OUTBOX_ALERT_INVALID_KIND');
    }
    if (!enabled()) return { success: false, skipped: true };

    // Only controlled category codes cross the notification boundary.
    // OperationalAlertService persists alerts for admins and attempts FCM push;
    // it neither relies on Axiom nor sends email.
    try {
      const result = await sendAlert({
        type: kind,
        component: 'audit_outbox',
        severity: ALERT_TYPES[kind],
        code: kind
      });
      return { success: result?.success === true, suppressed: result?.suppressed === true };
    } catch (_error) {
      return { success: false, skipped: false };
    }
  };
}

function createProductionOutboxNotifier() {
  if (process.env.AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED !== 'true') return null;
  // Lazy initialization: do not connect to the DB or Firebase when disabled.
  const OperationalAlertService = require('./operationalAlertService');
  return createOutboxAdminNotifier({
    sendAlert: alert => OperationalAlertService.sendCriticalAlert(alert)
  });
}

module.exports = {
  ALERT_TYPES, createOutboxAdminNotifier, createProductionOutboxNotifier
};
