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

const normalizeDatabaseUrl = (value) => {
  if (!value) return value;
  const url = new URL(value);
  ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslaccept'].forEach((param) => {
    url.searchParams.delete(param);
  });
  return url.toString();
};

const isLocalDatabaseUrl = (value) => {
  if (!value) return false;
  const hostname = new URL(value).hostname;
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
};

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
  RESEARCH_STATEMENT_TIMEOUT_MS
};
