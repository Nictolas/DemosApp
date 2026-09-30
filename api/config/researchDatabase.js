const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let researchPool = null;

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
    max: Math.max(1, parseInt(process.env.RESEARCH_DATABASE_POOL_MAX || '5', 10)),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
    statement_timeout: 15000,
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

module.exports = { getResearchPool, closeResearchPool };
