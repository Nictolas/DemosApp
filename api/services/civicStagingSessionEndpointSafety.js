'use strict';

// Stage-only, negative-only connection-string validation. NO network I/O.
// The operator must copy the EXACT pooler host from Supabase Dashboard Connect;
// deriving an aws-N host from the project's region is explicitly prohibited.
// No credential, URL, host, user name or IP is returned or logged.
// Identity pinned to the single authorized Supabase Demos-Staging project.
// Stage-scoped environment flags and user names are NOT sufficient: a caller
// could otherwise provide credentials for another Supabase project.
const DEMOS_STAGING_PROJECT_REF = 'fkeayjzvtuvzesljhjbc';
const STAGING_SESSION_POOLER_HOST='aws-1-eu-central-1.pooler.supabase.com';
// The stage runtime secret can be a complete DSN OR the password-only value
// the operator was instructed to store. We build the exact staging endpoint
// internally and never log or return credentials to an HTTP response.
function resolveCivicStagingSessionConnectionString(secret) {
  if(typeof secret!=='string'||!secret) {
    throw new Error('CIVIC_STAGING_SESSION_CREDENTIAL_REQUIRED');
  }
  if(secret.startsWith('postgresql://')||secret.startsWith('postgres://')) return secret;
  // Do not reinterpret a malformed URI or pasted example as a password.
  if(secret.includes('://') || secret.length<24 || secret.length>512 ||
     /[\x00-\x20\x7f]/.test(secret)) {
    throw new Error('CIVIC_STAGING_SESSION_PASSWORD_INVALID');
  }
  return 'postgresql://demos_staging_runtime.'+DEMOS_STAGING_PROJECT_REF+':'+
    encodeURIComponent(secret)+'@'+STAGING_SESSION_POOLER_HOST+':5432/postgres';
}

function assertCivicStagingSessionEndpoint({
  connectionString,
  projectRef,
  expectedPoolerHost,
  env = {},
} = {}) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    throw new Error('CIVIC_STAGING_SESSION_UNSAFE_ENVIRONMENT');
  }
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

  if (projectRef !== DEMOS_STAGING_PROJECT_REF) {
    throw new Error('CIVIC_STAGING_SESSION_WRONG_PROJECT');
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
  let password;
  try {
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error('CIVIC_STAGING_SESSION_URL_INVALID');
  }
  if (!password || /^(?:\[YOUR-PASSWORD\]|YOUR-PASSWORD|password)$/i.test(password)) {
    throw new Error('CIVIC_STAGING_SESSION_CREDENTIAL_REQUIRED');
  }
  return true;
}

module.exports = { DEMOS_STAGING_PROJECT_REF, assertCivicStagingSessionEndpoint,
  resolveCivicStagingSessionConnectionString };
