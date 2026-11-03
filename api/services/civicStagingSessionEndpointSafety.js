'use strict';

// Stage-only, negative-only connection-string validation. NO network I/O.
// The operator must copy the EXACT pooler host from Supabase Dashboard Connect;
// deriving an aws-N host from the project's region is explicitly prohibited.
// No credential, URL, host, user name or IP is returned or logged.
function assertCivicStagingSessionEndpoint({
  connectionString,
  projectRef,
  expectedPoolerHost,
  env = {},
} = {}) {
  if (env.DATABASE_URL || env.PGHOST || env.PGUSER ||
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.CIVIC_PUSH_ENABLED === 'true' ||
      env.CIVIC_NEW_INITIATIVE_EVENTS_ENABLED === 'true' ||
      env.CIVIC_SESSION_LOCK_CONNECTION_VERIFIED === 'true') {
    throw new Error('CIVIC_STAGING_SESSION_UNSAFE_ENVIRONMENT');
  }

  if (typeof projectRef !== 'string' || !/^[a-z0-9]{20}$/.test(projectRef) ||
      typeof expectedPoolerHost !== 'string' ||
      !/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(expectedPoolerHost)) {
    throw new Error('CIVIC_STAGING_SESSION_EXACT_ENDPOINT_REQUIRED');
  }

  if (typeof connectionString !== 'string' || !connectionString) {
    throw new Error('CIVIC_STAGING_SESSION_CREDENTIAL_REQUIRED');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('CIVIC_STAGING_SESSION_URL_INVALID');
  }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) ||
      url.hostname.toLowerCase() !== expectedPoolerHost ||
      url.port !== '5432' ||
      url.pathname !== '/postgres' ||
      url.search !== '' ||
      url.hash !== '') {
    throw new Error('CIVIC_STAGING_SESSION_ENDPOINT_MISMATCH');
  }

  let username;
  try {
    username = decodeURIComponent(url.username);
  } catch {
    throw new Error('CIVIC_STAGING_SESSION_URL_INVALID');
  }
  if (username !== 'demos_staging_runtime.' + projectRef) {
    throw new Error('CIVIC_STAGING_SESSION_ROLE_MISMATCH');
  }
  if (!url.password || /^(?:\[YOUR-PASSWORD\]|YOUR-PASSWORD|password)$/i.test(
    decodeURIComponent(url.password))) {
    throw new Error('CIVIC_STAGING_SESSION_CREDENTIAL_REQUIRED');
  }
  return true;
}

module.exports = { assertCivicStagingSessionEndpoint };
