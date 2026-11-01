'use strict';

/**
 * Session advisory locks are unsafe through transaction-mode PgBouncer and
 * Supavisor: an unlock can land on a different PostgreSQL backend.
 *
 * Require a separately verified session-affine connection. Checking the URL
 * alone does NOT prove that a custom proxy preserves session affinity, so
 * operators must explicitly confirm the backend configuration too.
 *
 * Never print or return connection strings, credentials, or hostnames.
 */
function assertCivicSessionLockCompatible({
  databaseUrl = process.env.DATABASE_URL,
  manuallyVerified = process.env.CIVIC_SESSION_LOCK_CONNECTION_VERIFIED === 'true',
} = {}) {
  if (manuallyVerified !== true) {
    throw new Error('CIVIC_SESSION_LOCK_NOT_VERIFIED');
  }
  if (typeof databaseUrl !== 'string' || !databaseUrl) {
    throw new Error('CIVIC_SESSION_LOCK_DATABASE_URL_MISSING');
  }
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('CIVIC_SESSION_LOCK_DATABASE_URL_INVALID');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('CIVIC_SESSION_LOCK_DATABASE_URL_INVALID');
  }

  const host = url.hostname.toLowerCase();
  const port = url.port || '5432';
  if (!host || !url.pathname || url.pathname === '/') {
    throw new Error('CIVIC_SESSION_LOCK_DATABASE_URL_INVALID');
  }
  const unsafeParams = ['host', 'hostaddr', 'service', 'pool_mode', 'poolmode', 'options'];
  const pgbouncer = url.searchParams.get('pgbouncer');
  if (unsafeParams.some(key => url.searchParams.has(key)) ||
      (pgbouncer !== null && pgbouncer.toLowerCase() !== 'false')) {
    throw new Error('CIVIC_SESSION_LOCK_UNSAFE_POOLER_MODE');
  }
  // Supavisor transaction pooler and PgBouncer commonly listen on 6543.
  // Never accept 6543 with a manual override; require a session endpoint.
  if (port === '6543') {
    throw new Error('CIVIC_SESSION_LOCK_UNSAFE_POOLER_MODE');
  }
  // Supabase's session pooler and direct connection both use port 5432.
  const isSupabase = host.endsWith('.supabase.com') || host === 'supabase.com';
  if (isSupabase && port !== '5432') {
    throw new Error('CIVIC_SESSION_LOCK_UNSAFE_POOLER_MODE');
  }
  return true;
}

module.exports = { assertCivicSessionLockCompatible };
