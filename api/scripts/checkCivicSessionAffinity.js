'use strict';

// Optional read-only staging preflight. Default execution makes NO DB
// connection. Applying it observes only pg_backend_pid() on two connections;
// it never proves that push delivery is safe or enables feature flags.
//
// Explicit staging-only invocation after a separate approval:
// CIVIC_SESSION_AFFINITY_PROBE_APPLY=true
// CIVIC_SESSION_AFFINITY_PROBE_CONFIRM=I_APPROVE_READONLY_STAGING_PROBE
// CIVIC_SESSION_AFFINITY_PROBE_ENV=staging
// node api/scripts/checkCivicSessionAffinity.js
//
// Never copy DATABASE_URL, database PIDs, FCM tokens or credentials into logs.
const { probeCivicSessionAffinity } =
  require('../services/civicSessionAffinityProbe');

async function main() {
  const apply = process.env.CIVIC_SESSION_AFFINITY_PROBE_APPLY === 'true';
  const confirmed = process.env.CIVIC_SESSION_AFFINITY_PROBE_CONFIRM ===
    'I_APPROVE_READONLY_STAGING_PROBE';
  const environment = process.env.CIVIC_SESSION_AFFINITY_PROBE_ENV || '';

  // Do not load the DB pool at all for a default preview.
  if (!apply) {
    const result = await probeCivicSessionAffinity(null);
    console.log('CIVIC_SESSION_AFFINITY_PREFLIGHT', JSON.stringify(result));
    return result;
  }
  if (!confirmed || environment !== 'staging') {
    throw new Error('CIVIC_SESSION_PROBE_STAGING_CONFIRMATION_REQUIRED');
  }

  const { getPool, closePool } = require('../config/database');
  try {
    const result = await probeCivicSessionAffinity(getPool(), {
      apply, confirmed, environment,
    });
    console.log('CIVIC_SESSION_AFFINITY_PREFLIGHT', JSON.stringify(result));
    if (result.result !== 'INCONCLUSIVE') process.exitCode = 1;
    return result;
  } finally {
    await closePool().catch(() => {});
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error('CIVIC_SESSION_AFFINITY_UNAVAILABLE');
    process.exitCode = 1;
  });
}

module.exports = { main };
