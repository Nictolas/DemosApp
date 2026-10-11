'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  TEST_SOURCE,
  TEST_OFFICE,
  TEST_OPINION_COLUMN,
  pickOpinionColumn,
  runStagingPoliticalOpinionNotificationSelfTest,
} = require('../scripts/stagingPoliticalOpinionNotificationSelfTest');

function noQueryPool() {
  return {
    async query() {
      throw new Error('database must not be touched');
    },
  };
}

test('opinion notification staging E2E is disabled by default without touching the database', async () => {
  const result = await runStagingPoliticalOpinionNotificationSelfTest({
    env: { NODE_ENV: 'staging' },
    pool: noQueryPool(),
    fetchImpl: async () => { throw new Error('fetch must not be called'); },
  });
  assert.deepEqual(result, { mode: 'disabled', passed: 0, total: 3 });
});

test('opinion notification staging E2E refuses to run outside staging', async () => {
  await assert.rejects(
    runStagingPoliticalOpinionNotificationSelfTest({
      env: { NODE_ENV: 'production', DEMOS_STAGING_OPINION_NOTIFICATION_E2E: 'true' },
      pool: noQueryPool(),
      fetchImpl: async () => new Response('{}', { status: 200 }),
    }),
    /allowed only with NODE_ENV=staging/,
  );
});

test('pickOpinionColumn returns a safe writable opinion column from the real response table', async () => {
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(sql);
      return { rows: [{ id: 'energia_nucleare' }] };
    },
  };
  assert.deepEqual(await pickOpinionColumn(pool), { id: 'energia_nucleare', temporary: false });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0], /opinioni_domande/);
  assert.match(calls[0], /information_schema\.columns/);
  assert.match(calls[0], /fonti_opinioni/);
  assert.match(calls[0], /created_at/);
  assert.match(calls[0], /updated_at/);
});


test('pickOpinionColumn creates an isolated temporary opinion column when staging has none', async () => {
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(sql);
      if (calls.length === 1) return { rows: [] };
      return { rows: [] };
    },
  };
  assert.deepEqual(await pickOpinionColumn(pool), { id: TEST_OPINION_COLUMN, temporary: true });
  assert.equal(calls.length, 2);
  assert.match(calls[1], /ALTER TABLE opinioni_risposte ADD COLUMN IF NOT EXISTS/);
  assert.match(calls[1], new RegExp(TEST_OPINION_COLUMN));
});
test('pickOpinionColumn rejects an unsafe identifier even if returned by the database', async () => {
  const pool = { async query() { return { rows: [{ id: 'bad-column;drop' }] }; } };
  await assert.rejects(pickOpinionColumn(pool), /Unsafe opinion column/);
});

test('staging server wires the dedicated fail-closed opinion notification E2E flag', () => {
  const server = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /DEMOS_STAGING_OPINION_NOTIFICATION_E2E/);
  assert.match(server, /runStagingPoliticalOpinionNotificationSelfTest/);
  assert.match(server, /server\.close\(\(\) => process\.exit\(1\)\)/);
});

test('E2E fixture identifiers are isolated from normal political office/source identifiers', () => {
  assert.equal(TEST_SOURCE, 'STAGING_E2E_OPINION');
  assert.equal(TEST_OFFICE, 'e2e.opinion-notification');
  assert.equal(TEST_OPINION_COLUMN, 'e2e_opinion_notification_test');
});
