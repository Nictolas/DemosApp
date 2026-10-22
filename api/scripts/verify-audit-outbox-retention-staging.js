'use strict';

// Run explicitly in the already-isolated staging probe, not on production.
// Uses its single dedicated, limited PostgreSQL secret. Exits without starting
// the app, worker or any external provider, and never changes a record.
async function checkStagingRetention({
  env = process.env,
  createDb = require('../services/auditOutboxDatabase').createAuditOutboxDatabase,
  snapshot = require('../services/auditOutboxRetentionSnapshot').readRetentionSnapshot
} = {}) {
  const { assertSafeRenderStagingEnvironment } =
    require('../services/auditOutboxRenderStagingReadiness');
  const { normalizeReadonlyStagingUri } =
    require('./audit-outbox-readonly-health-server');
  const safeEnv = { ...env, AUDIT_OUTBOX_DATABASE_URL:
    normalizeReadonlyStagingUri(env.AUDIT_OUTBOX_DATABASE_URL) };
  assertSafeRenderStagingEnvironment(safeEnv);
  const { pool, ensureReady } = createDb({ env: safeEnv, standalonePreflight: true });
  try {
    return await snapshot({ pool, ensureReady, env: safeEnv });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkStagingRetention().then(result => {
    console.log(JSON.stringify(result));
  }).catch(() => {
    console.error('OUTBOX_RETENTION_READONLY_REJECTED');
    process.exitCode = 1;
  });
}

module.exports = { checkStagingRetention };
