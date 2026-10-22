'use strict';

// The outbox staging database and the Axiom dataset are separate security
// boundaries. Never let a staging worker write test events into DEMOS's live
// real-time/centralized_logs datasets because a default env var was reused.
// This is an explicit opt-in destination, already used for non-production
// security telemetry; only synthetic events may be sent during staging drills.
const STAGING_AXIOM_DATASET = 'demos-security-staging';

function assertOutboxAxiomTarget(dataset, scope = process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE) {
  const isStagingName = typeof dataset === 'string' &&
    /(?:^|[-_])staging(?:$|[-_])/.test(dataset);
  if ((scope === 'staging' && dataset !== STAGING_AXIOM_DATASET) ||
      (scope === 'production' && isStagingName)) {
    throw new Error('OUTBOX_AXIOM_DATASET_SCOPE_REJECTED');
  }
  return dataset;
}


const STAGING_ALLOWED_FIELDS = Object.freeze(new Set([
  '_time', 'log_type', 'action', 'resource', 'success', 'synthetic',
  'user_id', 'ip_address', 'resource_id', 'session_id', 'error_message',
  'axiom_delivery_id'
]));
const STAGING_NULL_ONLY_FIELDS = Object.freeze([
  'user_id', 'ip_address', 'resource_id', 'session_id', 'error_message'
]);

// Staging deliveries must be unambiguously synthetic before enqueue AND
// immediately before HTTP transport (including rows queued before a deploy).
// Never accept arbitrary free text or identifiers from a real user session.
// No effect outside the explicit staging scope.
function assertStagingSyntheticOutboxEvent(event, scope = process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE) {
  if (scope !== 'staging') return true;
  const valid = event && typeof event === 'object' && !Array.isArray(event) &&
    Object.keys(event).every(key => STAGING_ALLOWED_FIELDS.has(key)) &&
    STAGING_NULL_ONLY_FIELDS.every(key => event[key] == null) &&
    event.log_type === 'audit' &&
    event.synthetic === true &&
    event.action === 'STAGING_OUTBOX_DRILL' &&
    event.resource === 'outbox' &&
    event.success === true &&
    typeof event._time === 'string' &&
    /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/.test(event._time) &&
    Number.isFinite(Date.parse(event._time)) &&
    (event.axiom_delivery_id === undefined ||
      (typeof event.axiom_delivery_id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.axiom_delivery_id)));
  if (!valid) throw new Error('OUTBOX_STAGING_SYNTHETIC_ONLY');
  return true;
}

module.exports = { STAGING_AXIOM_DATASET, assertOutboxAxiomTarget, assertStagingSyntheticOutboxEvent };
