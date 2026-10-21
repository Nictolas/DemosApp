'use strict';

// Render deployment bootstrap: read-only safety gate for an isolated DEMOS
// audit-outbox staging service. The code must never launch the main API,
// start workers, ingest into Axiom, or run the B2 archive.
const { validateStagingOutboxTarget } = require('./auditOutboxStagingGuard');
const { STAGING_AXIOM_DATASET } = require('./auditOutboxAxiomTarget');

const FORBIDDEN_ENABLED_FLAGS = Object.freeze([
  'AUDIT_OUTBOX_ENABLED',
  'AUDIT_OUTBOX_WORKER_ENABLED',
  'AUDIT_OUTBOX_SECURITY_ENABLED',
  'AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED',
  'AXIOM_ARCHIVE_ENABLED'
]);

function assertSafeRenderStagingEnvironment(env = process.env) {
  if (env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE !== 'staging' ||
      FORBIDDEN_ENABLED_FLAGS.some(name => env[name] === 'true') ||
      env.AXIOM_REALTIME_DATASET !== STAGING_AXIOM_DATASET ||
      env.AXIOM_DATASET !== STAGING_AXIOM_DATASET ||
      env.AUDIT_OUTBOX_PREFLIGHT_ONLY !== 'true' ||
      env.DATABASE_URL || !env.AUDIT_OUTBOX_DATABASE_URL) {
    throw new Error('AUDIT_RENDER_STAGING_ENV_REJECTED');
  }
  try {
    const target = validateStagingOutboxTarget(env.AUDIT_OUTBOX_DATABASE_URL);
    // Render Free egress is IPv4: direct Supabase Free resolves to IPv6.
    // Require the verified IPv4 session pooler for a runnable preflight.
    if (target.mode !== 'session-pooler') {
      throw new Error('AUDIT_RENDER_STAGING_ENV_REJECTED');
    }
    return { stagingRef: target.stagingRef, mode: target.mode };
  } catch (_error) {
    // Never leak a connection URI or a database driver's error text.
    throw new Error('AUDIT_RENDER_STAGING_ENV_REJECTED');
  }
}

async function runRenderStagingReadiness({
  env = process.env,
  preflight = () => require('./auditOutboxStagingGuard').runStagingOutboxPreflight({ env })
} = {}) {
  const expected = assertSafeRenderStagingEnvironment(env);
  const outcome = await preflight();
  if (outcome?.stagingRef !== expected.stagingRef ||
      outcome.roleAuthorized !== true ||
      outcome.readOnly !== true) {
    throw new Error('AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
  }
  return {
    result: 'AUDIT_RENDER_STAGING_PREFLIGHT_OK',
    stagingRef: expected.stagingRef,
    readOnly: true,
    outboxEnabled: false,
    archiveEnabled: false
  };
}

module.exports = {
  FORBIDDEN_ENABLED_FLAGS,
  assertSafeRenderStagingEnvironment,
  runRenderStagingReadiness
};
