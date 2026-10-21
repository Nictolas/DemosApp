'use strict';

// This guard is deliberately pinned to DEMOS's dedicated staging project.
// It must never accept the production project or any arbitrary URL.
const STAGING_PROJECT_REF = 'fkeayjzvtuvzesljhjbc';
// Verified from the project's Connect > Session pooler URI, 22 Oct 2026.
// The shared pooler cluster index cannot be guessed from the AWS region.
const STAGING_POOLER_HOST = 'aws-1-eu-central-1.pooler.supabase.com';

function validateStagingOutboxTarget(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch (_error) {
    throw new Error('AUDIT_STAGING_TARGET_REJECTED');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.password.length === 0 || url.pathname !== '/postgres' ||
      url.port !== '5432' || url.hash !== '') {
    throw new Error('AUDIT_STAGING_TARGET_REJECTED');
  }

  const hostname = url.hostname.toLowerCase();
  // Reject percent-encoded role names rather than interpreting them loosely.
  const username = url.username;
  const direct = hostname === `db.${STAGING_PROJECT_REF}.supabase.co` &&
    /^demos_outbox_[a-z0-9_]{1,40}$/.test(username);
  const sessionPooler =
    hostname === STAGING_POOLER_HOST &&
    /^demos_outbox_[a-z0-9_]{1,40}$/.test(username.split('.')[0]) &&
    username.endsWith(`.${STAGING_PROJECT_REF}`);
  if (!direct && !sessionPooler) {
    throw new Error('AUDIT_STAGING_TARGET_REJECTED');
  }
  return { stagingRef: STAGING_PROJECT_REF, mode: direct ? 'direct' : 'session-pooler' };
}

async function runStagingOutboxPreflight({
  env = process.env,
  open = () => require('./auditOutboxDatabase').createAuditOutboxDatabase({ env })
} = {}) {
  validateStagingOutboxTarget(env.AUDIT_OUTBOX_DATABASE_URL);
  const { pool, ensureReady } = open();
  try {
    await ensureReady();
    const result = await pool.query('SELECT current_database() AS name');
    if (result.rows?.[0]?.name !== 'postgres') {
      throw new Error('AUDIT_STAGING_PREFLIGHT_REJECTED');
    }
    // Never return user names, queries, database URLs, or any event rows.
    return { stagingRef: STAGING_PROJECT_REF, roleAuthorized: true, readOnly: true };
  } finally {
    await pool.end();
  }
}

module.exports = {
  STAGING_PROJECT_REF, STAGING_POOLER_HOST, validateStagingOutboxTarget, runStagingOutboxPreflight
};
