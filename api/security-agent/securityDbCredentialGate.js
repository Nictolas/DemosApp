const PURPOSES = Object.freeze({
  writer: Object.freeze({
    enableEnv: 'SECURITY_AGENT_STORE_ENABLED',
    urlEnv: 'SECURITY_AGENT_DATABASE_URL',
    expectedUsername: 'demos_security_agent_runtime',
    applicationName: 'demos-security-agent-writer',
    max: 4
  }),
  reader: Object.freeze({
    enableEnv: 'SECURITY_CENTER_STORE_ENABLED',
    urlEnv: 'SECURITY_CENTER_DATABASE_URL',
    expectedUsername: 'demos_security_center_runtime',
    applicationName: 'demos-security-center-reader',
    max: 3
  }),
  maintenance: Object.freeze({
    enableEnv: 'SECURITY_RETENTION_JOB_ENABLED',
    urlEnv: 'SECURITY_RETENTION_DATABASE_URL',
    expectedUsername: 'demos_security_retention_runtime',
    applicationName: 'demos-security-retention-maintenance',
    max: 1
  })
});

const BLOCKED_DATABASE_USERS = new Set([
  'postgres', 'service_role', 'supabase_admin', 'authenticator', 'anon', 'authenticated'
]);
const SSL_QUERY_KEYS = ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'];

function gateError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseRetentionDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw gateError('SECURITY_RETENTION_POLICY_INVALID');
  }
  return days;
}

function assertPolicyGate(env) {
  if (env.SECURITY_STORE_POLICY_APPROVED !== 'true') {
    throw gateError('SECURITY_RETENTION_POLICY_NOT_APPROVED');
  }
  return parseRetentionDays(env.SECURITY_STORE_RETENTION_DAYS);
}

function parseCredentialUrl(rawValue, expectedUsername) {
  if (!rawValue || typeof rawValue !== 'string') {
    throw gateError('SECURITY_DATABASE_CREDENTIAL_MISSING');
  }
  let url;
  try { url = new URL(rawValue); }
  catch (_error) { throw gateError('SECURITY_DATABASE_CREDENTIAL_INVALID'); }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw gateError('SECURITY_DATABASE_CREDENTIAL_INVALID');
  }
  const username = decodeURIComponent(url.username || '');
  const password = decodeURIComponent(url.password || '');
  if (!username || !url.hostname || !password || password.length < 24) {
    throw gateError('SECURITY_DATABASE_CREDENTIAL_INVALID');
  }
  if (BLOCKED_DATABASE_USERS.has(username)) {
    throw gateError('SECURITY_DATABASE_ROLE_FORBIDDEN');
  }
  if (username !== expectedUsername) {
    throw gateError('SECURITY_DATABASE_ROLE_MISMATCH');
  }

  for (const key of SSL_QUERY_KEYS) url.searchParams.delete(key);
  return { username, connectionString: url.toString() };
}

function buildSecurityDbClientConfig({ env = process.env, purpose } = {}) {
  const spec = PURPOSES[purpose];
  if (!spec) throw gateError('SECURITY_DATABASE_PURPOSE_INVALID');
  if (env[spec.enableEnv] !== 'true') {
    return Object.freeze({ enabled: false, purpose });
  }

  const retentionDays = assertPolicyGate(env);
  const credential = parseCredentialUrl(env[spec.urlEnv], spec.expectedUsername);
  const ca = typeof env.SECURITY_DATABASE_CA === 'string' && env.SECURITY_DATABASE_CA.trim()
    ? env.SECURITY_DATABASE_CA
    : undefined;

  return Object.freeze({
    enabled: true,
    purpose,
    username: credential.username,
    retentionDays,
    poolConfig: Object.freeze({
      connectionString: credential.connectionString,
      ssl: Object.freeze({ rejectUnauthorized: true, ...(ca ? { ca } : {}) }),
      application_name: spec.applicationName,
      max: spec.max,
      min: 0,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 15000,
      query_timeout: 20000
    })
  });
}

function publicCredentialStatus(config) {
  return Object.freeze({
    enabled: config?.enabled === true,
    purpose: String(config?.purpose || '').slice(0, 32),
    configured: config?.enabled === true,
    role: config?.enabled === true ? String(config.username || '').slice(0, 80) : null,
    retentionDays: config?.enabled === true ? Number(config.retentionDays || 0) : null,
    tlsVerified: config?.enabled === true
      ? config.poolConfig?.ssl?.rejectUnauthorized === true
      : null
  });
}

function createPoolForPurpose({ env = process.env, purpose, PoolCtor } = {}) {
  const config = buildSecurityDbClientConfig({ env, purpose });
  if (!config.enabled) {
    return { enabled: false, pool: null, status: publicCredentialStatus(config) };
  }
  if (typeof PoolCtor !== 'function') {
    throw gateError('SECURITY_DATABASE_POOL_FACTORY_MISSING');
  }
  const pool = new PoolCtor(config.poolConfig);
  return { enabled: true, pool, status: publicCredentialStatus(config) };
}

module.exports = {
  PURPOSES,
  BLOCKED_DATABASE_USERS,
  buildSecurityDbClientConfig,
  createPoolForPurpose,
  publicCredentialStatus,
  parseRetentionDays
};
