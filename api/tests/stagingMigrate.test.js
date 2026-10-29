'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStagingUrl, createClient, seedE2EUser } = require('../scripts/stagingMigrate');

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

test('staging baseline includes the minimal opinion catalog used by notification text resolution', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const baseline = fs.readFileSync(path.resolve(__dirname, '..', 'database', 'staging-base-schema.sql'), 'utf8');
  assert.match(baseline, /CREATE TABLE IF NOT EXISTS opinioni_domande/);
  assert.match(baseline, /id TEXT PRIMARY KEY/);
  assert.match(baseline, /text TEXT NOT NULL/);
  assert.match(baseline, /gradi_opinione TEXT\[\]/);
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

test('staging baseline reconciles legacy consent columns when users already exists', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const baseline = fs.readFileSync(path.resolve(__dirname, '..', 'database', 'staging-base-schema.sql'), 'utf8');
  for (const column of [
    'privacy_policy_consent BOOLEAN DEFAULT FALSE',
    'terms_of_service_consent BOOLEAN DEFAULT FALSE',
    'consent_timestamp TIMESTAMPTZ',
    'consent_ip_address TEXT',
    'consent_user_agent TEXT',
    'political_opinions_consent BOOLEAN DEFAULT FALSE',
    'political_opinions_consent_timestamp TIMESTAMPTZ',
    'political_opinions_consent_ip_address TEXT',
    'political_opinions_consent_user_agent TEXT',
  ]) {
    assert.ok(
      baseline.includes(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column};`),
      `missing idempotent staging reconciliation for: ${column}`,
    );
  }
});

test('E2E user seeding uses the DB default for both PERSON and compact P', async () => {
  for (const accountDefault of ["'PERSON'::character varying", "'P'::character varying"]) {
    const sqlWrites = [];
    const client = {
      async query(sql, values) {
        if (sql.includes('FROM information_schema.columns')) {
          return { rows: [{ column_default: accountDefault }] };
        }
        if (sql.startsWith('SELECT id, account_type FROM users')) {
          return { rows: [{ id: 'synthetic', account_type: accountDefault.includes("'P'::") ? 'P' : 'PERSON' }] };
        }
        sqlWrites.push({ sql, values });
        return { rows: [] };
      }
    };
    const result = await seedE2EUser(client, { log() {} });
    assert.equal(result, '00000000-0000-4000-8000-000000000001');
    const inserts = sqlWrites.filter(item => /INSERT INTO users\\b/.test(item.sql));
    assert.equal(inserts.length, 3);
    for (const {sql,values} of inserts) {
      assert.doesNotMatch(sql, /\\baccount_type\\b/,
        'Seed must preserve existing person type and use DB default for inserts');
      assert.ok(!(values || []).includes('PERSON'), 'Legacy value must not be sent as a query parameter');
    }
  }
});

test('E2E seeding rejects an unknown account_type default before any writes', async () => {
  let writes = 0;
  const client = { async query(sql) {
    if (sql.includes('information_schema.columns')) return { rows:[{column_default:"'ORGANIZATION'::character varying"}] };
    writes++;
    return { rows:[] };
  }};
  await assert.rejects(() => seedE2EUser(client), /default must be PERSON or P/);
  assert.equal(writes,0);
});

test('E2E seeding rejects an existing non-person synthetic ID before writes', async () => {
  let writes = 0;
  const client = { async query(sql) {
    if (sql.includes('information_schema.columns')) return {rows:[{column_default:"'P'::character varying"}]};
    if (sql.startsWith('SELECT id, account_type FROM users')) return {rows:[{id:'synthetic',account_type:'O'}]};
    writes++;
    return {rows:[]};
  }};
  await assert.rejects(() => seedE2EUser(client), /non-person account/);
  assert.equal(writes,0);
});
