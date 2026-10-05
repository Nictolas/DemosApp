const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let researchPool = null;

const RESEARCH_POOL_DEFAULT_MAX = 5;
const RESEARCH_POOL_HARD_MAX = 10;
const RESEARCH_IDLE_TIMEOUT_MS = 15000;
const RESEARCH_CONNECTION_TIMEOUT_MS = 5000;
const RESEARCH_QUERY_TIMEOUT_MS = 10000;
const RESEARCH_STATEMENT_TIMEOUT_MS = 10000;

const parseResearchPoolMax = (value = process.env.RESEARCH_DATABASE_POOL_MAX) => {
  if (value === undefined || value === null || value === '') return RESEARCH_POOL_DEFAULT_MAX;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error('RESEARCH_DATABASE_POOL_MAX must be an integer between 1 and 10');
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > RESEARCH_POOL_HARD_MAX) {
    throw new Error('RESEARCH_DATABASE_POOL_MAX must be an integer between 1 and 10');
  }
  return parsed;
};

const RESEARCH_TLS_QUERY_PARAMS = Object.freeze([
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'sslaccept'
]);
const RESEARCH_DATABASE_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const RESEARCH_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const parseResearchDatabaseUrl = (value) => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new Error('RESEARCH_DATABASE_URL must be a canonical PostgreSQL URL');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('RESEARCH_DATABASE_URL must be a canonical PostgreSQL URL');
  }

  if (!RESEARCH_DATABASE_PROTOCOLS.has(url.protocol)) {
    throw new Error('RESEARCH_DATABASE_URL must use postgres:// or postgresql://');
  }
  if (!url.hostname || !url.username || !url.pathname || url.pathname === '/') {
    throw new Error('RESEARCH_DATABASE_URL must include host, username and database name');
  }
  if (url.hash) {
    throw new Error('RESEARCH_DATABASE_URL fragments are forbidden');
  }

  return url;
};

const normalizeDatabaseUrl = (value) => {
  const url = parseResearchDatabaseUrl(value);
  RESEARCH_TLS_QUERY_PARAMS.forEach((param) => url.searchParams.delete(param));
  return url.toString();
};

const isLocalDatabaseUrl = (value) =>
  RESEARCH_LOCAL_HOSTS.has(parseResearchDatabaseUrl(value).hostname);

const getResearchPool = () => {
  if (researchPool) return researchPool;

  const rawUrl = process.env.RESEARCH_DATABASE_URL;
  if (!rawUrl) {
    throw new Error('RESEARCH_DATABASE_URL is required for the Research service');
  }

  const ssl = isLocalDatabaseUrl(rawUrl)
    ? false
    : {
        rejectUnauthorized: true,
        ca: fs.readFileSync(path.join(__dirname, '..', 'certs', 'prod-ca-2021.crt'), 'utf8')
      };

  researchPool = new Pool({
    connectionString: normalizeDatabaseUrl(rawUrl),
    ssl,
    min: 0,
    max: parseResearchPoolMax(),
    idleTimeoutMillis: RESEARCH_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: RESEARCH_CONNECTION_TIMEOUT_MS,
    query_timeout: RESEARCH_QUERY_TIMEOUT_MS,
    statement_timeout: RESEARCH_STATEMENT_TIMEOUT_MS,
    keepAlive: true,
    application_name: 'demos-research-shadow'
  });

  return researchPool;
};

const closeResearchPool = async () => {
  if (!researchPool) return;
  await researchPool.end();
  researchPool = null;
};

module.exports = {
  getResearchPool,
  closeResearchPool,
  parseResearchPoolMax,
  RESEARCH_POOL_DEFAULT_MAX,
  RESEARCH_POOL_HARD_MAX,
  RESEARCH_IDLE_TIMEOUT_MS,
  RESEARCH_CONNECTION_TIMEOUT_MS,
  RESEARCH_QUERY_TIMEOUT_MS,
  RESEARCH_STATEMENT_TIMEOUT_MS,
  parseResearchDatabaseUrl,
  normalizeDatabaseUrl,
  isLocalDatabaseUrl
};
