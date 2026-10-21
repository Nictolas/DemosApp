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

module.exports = { STAGING_AXIOM_DATASET, assertOutboxAxiomTarget };
