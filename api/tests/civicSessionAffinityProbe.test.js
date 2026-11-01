'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { probeCivicSessionAffinity } =
  require('../services/civicSessionAffinityProbe');

const SESSION_URL =
  'postgresql://postgres:fake-ci-secret@db.project.supabase.co:5432/postgres';
const TRANSACTION_URL =
  'postgresql://postgres:fake-ci-secret@db.project.supabase.co:6543/postgres';

function fakePool({ sequences = [['101'], ['202']], errorAt = null } = {}) {
  const queries = [];
  const releases = [];
  let connects = 0;
  const pool = {
    options: { max: 2 },
    async connect() {
      const which = connects++;
      let n = 0;
      return {
        async query(sql) {
          queries.push(sql);
          if (errorAt === which) throw new Error('RAW_DB_PASSWORD_IN_ERROR');
          const source = sequences[which];
          if (!source) throw new Error('missing mock');
          return { rows: [{ pid: source[Math.min(n++, source.length - 1)] }] };
        },
        release(discard) { releases.push(Boolean(discard)); },
      };
    },
  };
  return { pool, queries, releases, get connects() { return connects; } };
}

test('preview does not connect or inspect a database', async () => {
  const result = await probeCivicSessionAffinity(null);
  assert.deepEqual(result, {
    dryRun: true,
    result: 'NOT_TESTED',
    compatible: false,
    operatorReviewRequired: true,
  });
});

test('requires deliberate staging confirmation before DB access', async () => {
  for (const options of [
    { apply: true, confirmed: false, environment: 'staging' },
    { apply: true, confirmed: true, environment: 'production' },
    { apply: true, confirmed: true, environment: '' },
  ]) {
    const stub = fakePool();
    await assert.rejects(
      probeCivicSessionAffinity(stub.pool, { ...options, databaseUrl: SESSION_URL }),
      /CIVIC_SESSION_PROBE_STAGING_CONFIRMATION_REQUIRED/
    );
    assert.equal(stub.connects, 0);
  }
});

test('rejects known transaction endpoints before connecting or running SQL', async () => {
  const stub = fakePool();
  await assert.rejects(
    probeCivicSessionAffinity(stub.pool, {
      apply: true, confirmed: true, environment: 'staging',
      databaseUrl: TRANSACTION_URL,
    }),
    /CIVIC_SESSION_LOCK_UNSAFE_POOLER_MODE/
  );
  assert.equal(stub.connects, 0);
  assert.deepEqual(stub.queries, []);
});

test('backend PID change proves unsafe session affinity without exposing PID', async () => {
  const stub = fakePool({ sequences: [['101', '301'], ['202', '202']] });
  const result = await probeCivicSessionAffinity(stub.pool, {
    apply: true, confirmed: true, environment: 'staging',
    databaseUrl: SESSION_URL, rounds: 3,
  });
  assert.equal(result.result, 'UNSAFE_AFFINITY_OBSERVED');
  assert.equal(result.compatible, false);
  assert.equal(result.operatorReviewRequired, true);
  assert.deepEqual(stub.releases, [false, false]);
  assert.ok(stub.queries.every(q => q === 'SELECT pg_backend_pid()::text AS pid'));
  assert.ok(!JSON.stringify(result).includes('301'));
});

test('same backend PID on two held connections also fails safety probe', async () => {
  const stub = fakePool({ sequences: [['101'], ['101']] });
  const result = await probeCivicSessionAffinity(stub.pool, {
    apply: true, confirmed: true, environment: 'staging',
    databaseUrl: SESSION_URL, rounds: 3,
  });
  assert.equal(result.result, 'UNSAFE_AFFINITY_OBSERVED');
});

test('stable distinct PIDs are only inconclusive, never a pass', async () => {
  const stub = fakePool();
  const result = await probeCivicSessionAffinity(stub.pool, {
    apply: true, confirmed: true, environment: 'staging',
    databaseUrl: SESSION_URL, rounds: 6,
  });
  assert.deepEqual(result, {
    dryRun: false, result: 'INCONCLUSIVE', compatible: false,
    operatorReviewRequired: true,
  });
  assert.equal(stub.queries.length, 12);
  assert.deepEqual(stub.releases, [false, false]);
});

test('invalid query result and provider errors fail closed with safe messages', async () => {
  for (const stub of [
    fakePool({ errorAt: 1 }),
    fakePool({ sequences: [[null], ['202']] }),
    fakePool({ sequences: [['not-a-pid'], ['202']] }),
  ]) {
    await assert.rejects(
      probeCivicSessionAffinity(stub.pool, {
        apply: true, confirmed: true, environment: 'staging',
        databaseUrl: SESSION_URL, rounds: 3,
      }),
      e => e.message === 'CIVIC_SESSION_PROBE_UNAVAILABLE' &&
        !e.message.includes('RAW_DB_PASSWORD_IN_ERROR')
    );
    assert.deepEqual(stub.releases, [true, true]);
  }
});

test('probe remains independent of actual push lock and has no data writes or sends', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../services/civicSessionAffinityProbe.js'), 'utf8');
  const cli = fs.readFileSync(
    path.resolve(__dirname, '../scripts/checkCivicSessionAffinity.js'), 'utf8');
  assert.match(src, /pg_backend_pid\(\)::text/);
  assert.doesNotMatch(src, /pg_advisory_lock\(|pg_advisory_xact_lock\(|INSERT INTO|UPDATE civic_|DELETE FROM|\.send\(/);
  assert.match(cli, /I_APPROVE_READONLY_STAGING_PROBE/);
  assert.match(cli, /CIVIC_SESSION_AFFINITY_PROBE_ENV/);
  assert.doesNotMatch(cli, /CIVIC_SESSION_LOCK_CONNECTION_VERIFIED\s*=/);
});
