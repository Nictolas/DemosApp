'use strict';

// Isolated test environment only. Keep project selection independent from
// service names, Render metadata, DNS aliases and self-reported flags.
const STAGING_PROJECT_ID = 'fkeayjzvtuvzesljhjbc';
const STAGING_RUNTIME_ROLE = 'demos_staging_runtime';
const STAGING_CONFIRMATION = 'synthetic-only-no-prod-providers';

const SAFE_ENV_KEYS = new Set([
  'NODE_ENV', 'DEMOS_DEPLOYMENT_SCOPE', 'DEMOS_STAGING_PROJECT_ID',
  'DEMOS_STAGING_CONFIRMATION', 'DATABASE_URL', 'DATABASE_POOL_MAX',
  'DATABASE_POOL_MIN', 'PERFORMANCE_MONITOR_ENABLED', 'ALLOW_DEV_API_SURFACE',
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
  // Error messages deliberately contain NO URI, user name, secret or value.
  const error = new Error(code);
  error.code = code;
  throw error;
}

function assertIsolatedStagingEnvironment(env = process.env) {
  if (!env || typeof env !== 'object' ||
      env.DEMOS_DEPLOYMENT_SCOPE !== 'isolated-staging' ||
      env.DEMOS_STAGING_PROJECT_ID !== STAGING_PROJECT_ID ||
      env.DEMOS_STAGING_CONFIRMATION !== STAGING_CONFIRMATION ||
      // Production-mode Express hides dev/migration/debug API routes.
      env.NODE_ENV !== 'production') {
    reject('DEMOS_STAGING_SCOPE_REJECTED');
  }

  // Strict allowlist: an accidental Firebase, B2, Axiom, Redis, Google,
  // mail, auth or production API secret must block boot, not be ignored.
  // A new key always needs a documented security review to be admitted.
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && value !== null &&
        !SAFE_ENV_KEYS.has(name)) {
      reject('DEMOS_STAGING_PROVIDER_ENV_REJECTED');
    }
  }

  if (env.PERFORMANCE_MONITOR_ENABLED !== 'false' ||
      (env.ALLOW_DEV_API_SURFACE && env.ALLOW_DEV_API_SURFACE !== 'false') ||
      !Number.isInteger(Number(env.DATABASE_POOL_MAX)) ||
      Number(env.DATABASE_POOL_MAX) < 1 ||
      Number(env.DATABASE_POOL_MAX) > 5 ||
      env.DATABASE_POOL_MIN !== '0' ||
      typeof env.PORT !== 'string' ||
      !/^[1-9][0-9]{0,4}$/.test(env.PORT) ||
      Number(env.PORT) > 65535) {
    reject('DEMOS_STAGING_SIDE_EFFECTS_REJECTED');
  }

  if (typeof env.DATABASE_URL !== 'string') {
    reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
  }
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hash || url.pathname !== '/postgres' ||
      !url.password || !url.hostname ||
      url.username !== STAGING_RUNTIME_ROLE &&
        url.username !== STAGING_RUNTIME_ROLE + '.' + STAGING_PROJECT_ID) {
    reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
  }

  // A pooler's hostname is shared across Supabase projects; the qualified
  // username MUST carry the staging project reference. A direct endpoint
  // embeds the same project reference in its immutable DNS hostname.
  const direct = url.hostname === 'db.' + STAGING_PROJECT_ID + '.supabase.co' &&
    url.username === STAGING_RUNTIME_ROLE &&
    (!url.port || url.port === '5432');
  const pooled = /^aws-\d+-eu-central-1\.pooler\.supabase\.com$/.test(url.hostname) &&
    url.username === STAGING_RUNTIME_ROLE + '.' + STAGING_PROJECT_ID &&
    ['5432', '6543'].includes(url.port);

  if (!direct && !pooled) {
    reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
  }

  // Block connection-string overrides (options/search_path, hostaddr,
  // multi-host routing, etc.). Supported settings cannot select another DB.
  const acceptedQuery = new Set(['sslmode', 'pgbouncer']);
  for (const [key, value] of url.searchParams) {
    if (!acceptedQuery.has(key) ||
        url.searchParams.getAll(key).length !== 1 ||
        (key === 'sslmode' && value !== 'require') ||
        (key === 'pgbouncer' && value !== 'true')) {
      reject('DEMOS_STAGING_DATABASE_TARGET_REJECTED');
    }
  }

  return Object.freeze({
    scope: 'isolated-staging',
    projectId: STAGING_PROJECT_ID,
    connectionKind: pooled ? 'supabase-pooler' : 'supabase-direct',
    // No URI, password or even connection username in results/logs.
    poolMax: Number(env.DATABASE_POOL_MAX)
  });
}

module.exports = {
  STAGING_PROJECT_ID,
  assertIsolatedStagingEnvironment
};
