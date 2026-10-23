'use strict';
// Standalone CLI, NEVER imported by the API or used as a background service.
const { assertStagingWorkerDrillEnvironment, runStagingWorkerDrill } =
  require('../services/auditOutboxStagingWorkerDrill');
const { normalizeReadonlyStagingUri } =
  require('./audit-outbox-readonly-health-server');

// Metadata only: this mode does not connect to a database, read credential
// values, resolve external hosts or send network traffic.
function preflightMetadata(env = process.env) {
  const required = [
    'AUDIT_OUTBOX_DATABASE_URL',
    'AXIOM_STAGING_DRILL_INGEST_TOKEN',
    'AXIOM_STAGING_DRILL_QUERY_TOKEN'
  ];
  const missing = required.filter(key => !env[key]);
  const guardedEnv = {
    ...env,
    AUDIT_OUTBOX_DATABASE_URL: normalizeReadonlyStagingUri(env.AUDIT_OUTBOX_DATABASE_URL)
  };
  let localSafetyValid = false;
  try {
    localSafetyValid = assertStagingWorkerDrillEnvironment(guardedEnv) === true;
  } catch (_) {
    localSafetyValid = false;
  }
  return {
    status: localSafetyValid
      ? 'STAGING_WORKER_DRILL_CONFIG_SHAPE_OK_PROVIDER_SCOPES_UNVERIFIED'
      : 'STAGING_WORKER_DRILL_LOCAL_PREFLIGHT_BLOCKED',
    missingVariables: missing,
    // Never return or print values, URLs, provider diagnostics or secrets.
    realDbLoginChecked: false,
    axiomTokenScopesChecked: false,
    sent: false
  };
}

if (require.main === module) {
  if (process.argv.length === 3 && process.argv[2] === '--preflight') {
    const result = preflightMetadata();
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.status !== 'STAGING_WORKER_DRILL_CONFIG_SHAPE_OK_PROVIDER_SCOPES_UNVERIFIED') {
      process.exitCode = 2;
    }
  } else if (process.argv.length !== 2) {
    process.stderr.write('STAGING_WORKER_DRILL_INVALID_ARGUMENTS_NO_NETWORK\n');
    process.exitCode = 2;
  } else {
  runStagingWorkerDrill().then(result => {
    // Fixed status/counts only. No token, URL, SQL or event identifiers.
    process.stdout.write(JSON.stringify(result) + '\n');
  }).catch(_error => {
    process.stderr.write('STAGING_WORKER_OUTBOX_AXIOM_E2E_NOT_VERIFIED\n');
    process.exitCode = 1;
  });
  }
}

module.exports = { preflightMetadata };
