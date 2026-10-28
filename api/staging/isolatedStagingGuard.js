'use strict';

// Phase 1: readiness-only staging, NO app routes, NO database credential.
// Phase 2 DB target validation below is pure and NOT used by boot.
const STAGING_PROJECT_ID = 'fkeayjzvtuvzesljhjbc';
const STAGING_RUNTIME_ROLE = 'demos_staging_runtime';
const STAGING_CONFIRMATION = 'synthetic-only-no-prod-providers';

const SAFE_ENV_KEYS = new Set([
  'NODE_ENV', 'DEMOS_DEPLOYMENT_SCOPE', 'DEMOS_STAGING_PROJECT_ID',
  'DEMOS_STAGING_CONFIRMATION', 'DEMOS_STAGING_RUNTIME_PROFILE',
  'PORT', 'TZ', 'LANG', 'LC_ALL', 'LC_CTYPE', 'HOME', 'PATH', 'PWD',
  'SHLVL', 'HOSTNAME', 'USER', 'LOGNAME', 'SHELL', 'TERM', 'NODE_VERSION',
  'RENDER', 'RENDER_SERVICE_ID', 'RENDER_SERVICE_NAME', 'RENDER_EXTERNAL_URL',
  'RENDER_GIT_COMMIT', 'RENDER_INSTANCE_ID', 'RENDER_SERVICE_TYPE',
  'RENDER_DISCOVERY_SERVICE', 'RENDER_INTERNAL_HOSTNAME', 'RENDER_HOSTNAME',
  'RENDER_CPU_COUNT', 'INIT_CWD', 'npm_config_user_agent',
  'npm_lifecycle_event', 'npm_lifecycle_script', 'npm_execpath',
  'npm_node_execpath', 'npm_package_json', 'npm_package_name',
  'npm_package_version'
]);

function reject(code) {
  // Never interpolate URI, project password, user input or environment value.
  const error = new Error(code);
  error.code = code;
  throw error;
}

function assertIsolatedStagingEnvironment(env = process.env) {
  if (!env || typeof env !== 'object' ||
      env.DEMOS_DEPLOYMENT_SCOPE !== 'isolated-staging' ||
      env.DEMOS_STAGING_PROJECT_ID !== STAGING_PROJECT_ID ||
      env.DEMOS_STAGING_CONFIRMATION !== STAGING_CONFIRMATION ||
      env.DEMOS_STAGING_RUNTIME_PROFILE !== 'readiness-only' ||
      env.NODE_ENV !== 'production') {
    reject('DEMOS_STAGING_SCOPE_REJECTED');
  }

  // In readiness-only mode NO DATABASE_URL, SQL pool configuration, password
  // or provider secret is allowed. This stage does not touch PostgreSQL.
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && value !== null && !SAFE_ENV_KEYS.has(name)) {
      reject('DEMOS_STAGING_PROVIDER_ENV_REJECTED');
    }
  }

  if (typeof env.PORT !== 'string' ||
      !/^[1-9][0-9]{0,4}$/.test(env.PORT) ||
      Number(env.PORT) > 65535) {
    reject('DEMOS_STAGING_SIDE_EFFECTS_REJECTED');
  }

  return Object.freeze({
    scope: 'isolated-staging',
    projectId: STAGING_PROJECT_ID,
    profile: 'readiness-only',
    databaseConnected: false
  });
}

// Not invoked by readiness-only startup. Pure offline validator for a future
// separately reviewed full functional staging with a dedicated SQL role.
// Passing this check is NOT proof of actual role grants, RLS or server identity.
function assertStagingDatabaseTarget(value) {
  if (typeof value !== 'string') {
    reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hash || url.pathname !== '/postgres' || !url.password || !url.hostname ||
      (url.username !== STAGING_RUNTIME_ROLE &&
       url.username !== STAGING_RUNTIME_ROLE + '.' + STAGING_PROJECT_ID)) {
    reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
  }

  const direct = url.hostname === 'db.' + STAGING_PROJECT_ID + '.supabase.co' &&
    url.username === STAGING_RUNTIME_ROLE &&
    (!url.port || url.port === '5432');
  const pooled = /^aws-\d+-eu-central-1\.pooler\.supabase\.com$/.test(url.hostname) &&
    url.username === STAGING_RUNTIME_ROLE + '.' + STAGING_PROJECT_ID &&
    ['5432', '6543'].includes(url.port);
  if (!direct && !pooled) {
    reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
  }

  // The offline target guard previously accepted a URI with no sslmode at
  // all. Do not let an accidentally unencrypted future connection string
  // pass this preliminary check. TLS certificate verification and effective
  // server identity remain separate runtime/provider gates.
  if (url.searchParams.getAll('sslmode').length !== 1 ||
      url.searchParams.get('sslmode') !== 'require') {
    reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
  }

  const acceptedQuery = new Set(['sslmode', 'pgbouncer']);
  for (const [key, val] of url.searchParams) {
    if (!acceptedQuery.has(key) ||
        url.searchParams.getAll(key).length !== 1 ||
        (key === 'sslmode' && val !== 'require') ||
        (key === 'pgbouncer' && val !== 'true')) {
      reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
    }
  }

  return Object.freeze({
    projectId: STAGING_PROJECT_ID,
    connectionKind: pooled ? 'supabase-pooler' : 'supabase-direct'
  });
}

module.exports = {
  STAGING_PROJECT_ID,
  assertIsolatedStagingEnvironment,
  assertStagingDatabaseTarget
};
