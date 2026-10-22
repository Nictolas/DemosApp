'use strict';

// Privacy/operations INVENTORY ONLY. No user IDs, IPs, event contents,
// deletes or provider access. Thresholds are review prompts, not an approved
// legal retention policy.
const SNAPSHOT_SQL = `
SELECT
  COUNT(*)::integer AS total,
  COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending,
  COUNT(*) FILTER (WHERE status = 'sending')::integer AS sending,
  COUNT(*) FILTER (WHERE status = 'dead_letter')::integer AS dead_letter,
  COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '15 minutes')::integer AS pending_over_15m,
  COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours')::integer AS pending_over_24h,
  COUNT(*) FILTER (WHERE status = 'dead_letter' AND created_at < NOW() - INTERVAL '72 hours')::integer AS dead_letter_over_72h,
  COUNT(*) FILTER (WHERE status = 'dead_letter' AND created_at < NOW() - INTERVAL '30 days')::integer AS dead_letter_over_30d,
  COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - created_at)))::integer, 0) AS oldest_age_seconds
FROM demos_private.audit_delivery_outbox
`;

const COUNT_FIELDS = Object.freeze([
  'total','pending','sending','dead_letter','pending_over_15m',
  'pending_over_24h','dead_letter_over_72h','dead_letter_over_30d',
  'oldest_age_seconds'
]);

async function readRetentionSnapshot({ pool, ensureReady, env = process.env } = {}) {
  // Prevent accidental use of this CLI against DEMOS production. All other
  // scope/role checks must pass in the dedicated preflight first.
  if (env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE !== 'staging' ||
      env.AUDIT_OUTBOX_PREFLIGHT_ONLY !== 'true' ||
      env.DATABASE_URL ||
      ['AUDIT_OUTBOX_ENABLED','AUDIT_OUTBOX_WORKER_ENABLED',
       'AUDIT_OUTBOX_SECURITY_ENABLED','AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED',
       'AXIOM_ARCHIVE_ENABLED'].some(key => env[key] === 'true') ||
      typeof pool?.query !== 'function' ||
      typeof ensureReady !== 'function') {
    throw new Error('OUTBOX_RETENTION_READONLY_REJECTED');
  }
  try {
    await ensureReady();
    const raw = await pool.query(SNAPSHOT_SQL);
    if (raw.rows?.length !== 1) throw new Error('BAD_AGGREGATES');
    const value = {};
    for (const name of COUNT_FIELDS) {
      const n = Number(raw.rows[0][name]);
      if (!Number.isSafeInteger(n) || n < 0) throw new Error('BAD_AGGREGATES');
      value[name] = n;
    }
    if (value.total !== value.pending + value.sending + value.dead_letter ||
        value.pending_over_24h > value.pending_over_15m ||
        value.pending_over_15m > value.pending ||
        value.dead_letter_over_30d > value.dead_letter_over_72h ||
        value.dead_letter_over_72h > value.dead_letter) {
      throw new Error('BAD_AGGREGATES');
    }
    return {
      status: 'OUTBOX_RETENTION_STAGING_SNAPSHOT_OK',
      ...value,
      // These indicate only operational review candidates, never legal expiry
      // and are not permission to delete even a single outbox event.
      needsReview: value.pending_over_24h > 0 ||
        value.dead_letter_over_72h > 0
    };
  } catch (_) {
    // Sanitized code, never expose SQL errors or event contents.
    throw new Error('OUTBOX_RETENTION_READONLY_FAILED');
  }
}

module.exports = { SNAPSHOT_SQL, readRetentionSnapshot };
