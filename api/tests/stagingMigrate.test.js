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
