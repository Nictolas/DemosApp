'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStagingUrl, createClient } = require('../scripts/stagingMigrate');

test('staging migrations reject production and other databases', () => {
  assert.throws(() => assertStagingUrl('postgres://user:pass@localhost/demos_production'), /Refusing database/);
  assert.throws(() => assertStagingUrl('postgres://user:pass@localhost/'), /Refusing database/);
  assert.deepEqual(assertStagingUrl('postgres://user:pass@localhost/demos_civic_staging_db'), { databaseName: 'demos_civic_staging_db' });
});

test('staging PostgreSQL client bounds connection and query waits', () => {
  const client = createClient('postgres://user:pass@localhost/demos_civic_staging_db');
  assert.equal(client.connectionParameters.connect_timeout, 15);
  assert.equal(client.connectionParameters.query_timeout, 15000);
  assert.equal(client.connectionParameters.statement_timeout, 15000);
});

test('staging baseline includes the legacy opinion response store used by the opinion API', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const baseline = fs.readFileSync(path.resolve(__dirname, '..', 'database', 'staging-base-schema.sql'), 'utf8');
  assert.match(baseline, /CREATE TABLE IF NOT EXISTS opinioni_risposte/);
  assert.match(baseline, /user_id UUID PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(baseline, /fonti_opinioni JSONB/);
});

test('staging baseline retains legacy consent compatibility columns during the normalization window', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const baseline = fs.readFileSync(path.resolve(__dirname, '..', 'database', 'staging-base-schema.sql'), 'utf8');
  for (const column of [
    'privacy_policy_consent BOOLEAN DEFAULT FALSE',
    'terms_of_service_consent BOOLEAN DEFAULT FALSE',
    'political_opinions_consent BOOLEAN DEFAULT FALSE',
    'political_opinions_consent_timestamp TIMESTAMPTZ',
    'political_opinions_consent_ip_address TEXT',
    'political_opinions_consent_user_agent TEXT',
  ]) {
    assert.ok(baseline.includes(column), `missing staging compatibility column: ${column}`);
  }
});
