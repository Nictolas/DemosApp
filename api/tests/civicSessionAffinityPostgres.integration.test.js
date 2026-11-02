'use strict';

// Real PostgreSQL test strictly limited to CI's disposable localhost civic_ci.
// No tables, tokens, account data or production/staging secrets are touched.
const test = require('node:test');
const assert = require('node:assert/strict');
const { probeCivicSessionAffinity } =
  require('../services/civicSessionAffinityProbe');

const urlText = process.env.CIVIC_TEST_DATABASE_URL;
function isEphemeralCivicCiDatabase(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return ['postgres:', 'postgresql:'].includes(u.protocol) &&
      ['127.0.0.1', 'localhost'].includes(u.hostname) &&
      u.port === '5432' && u.pathname === '/civic_ci' &&
      u.username === 'postgres';
  } catch {
    return false;
  }
}

test('only a local, disposable civic_ci PostgreSQL can be used', () => {
  assert.equal(isEphemeralCivicCiDatabase(
    'postgresql://postgres:ci@127.0.0.1:5432/civic_ci'), true);
  for (const bad of [
    '', undefined, 'postgresql://postgres:ci@db.example.test:5432/civic_ci',
    'postgresql://postgres:ci@127.0.0.1:6543/civic_ci',
    'postgresql://postgres:ci@127.0.0.1:5432/postgres',
  ]) assert.equal(isEphemeralCivicCiDatabase(bad), false);
});

test('two real PostgreSQL 16 sockets can be observed, always INCONCLUSIVE', {
  skip: !isEphemeralCivicCiDatabase(urlText),
}, async () => {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: urlText,
    max: 2,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  try {
    const result = await probeCivicSessionAffinity(pool, {
      apply: true,
      confirmed: true,
      environment: 'staging',
      databaseUrl: 'postgresql://postgres:ci-placeholder@127.0.0.1:5432/civic_ci',
      rounds: 6,
    });
    assert.deepEqual(result, {
      dryRun: false,
      result: 'INCONCLUSIVE',
      compatible: false,
      operatorReviewRequired: true,
    });
  } finally {
    await pool.end();
  }
});
