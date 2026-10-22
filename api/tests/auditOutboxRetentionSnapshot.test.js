'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readRetentionSnapshot, SNAPSHOT_SQL } =
  require('../services/auditOutboxRetentionSnapshot');
const { checkStagingRetention } =
  require('../scripts/verify-audit-outbox-retention-staging');

const url = 'postgresql://demos_outbox_runtime.fkeayjzvtuvzesljhjbc:synthetic-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';
const env = Object.freeze({
  AUDIT_OUTBOX_DATABASE_URL: url,
  AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'staging',
  AUDIT_OUTBOX_PREFLIGHT_ONLY: 'true',
  AXIOM_DATASET: 'demos-security-staging',
  AXIOM_REALTIME_DATASET: 'demos-security-staging',
  AUDIT_OUTBOX_ENABLED: 'false',
  AUDIT_OUTBOX_WORKER_ENABLED: 'false',
  AUDIT_OUTBOX_SECURITY_ENABLED: 'false',
  AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED: 'false',
  AXIOM_ARCHIVE_ENABLED: 'false'
});

function data(overrides = {}) {
  return {
    total: 5, pending: 2, sending: 1, dead_letter: 2,
    pending_over_15m: 1, pending_over_24h: 1,
    dead_letter_over_72h: 1, dead_letter_over_30d: 0,
    oldest_age_seconds: 130000, ...overrides
  };
}

test('aggregates only statuses, counts and ages; never reads event payload or identities', async () => {
  let checked = false, calls = 0;
  const result = await readRetentionSnapshot({
    env,
    ensureReady: async () => { checked = true; },
    pool: { query: async sql => {
      assert.equal(checked, true);
      assert.equal(sql, SNAPSHOT_SQL);
      assert.match(sql, /COUNT\(\*\)/);
      for (const forbidden of ['user_id','ip_address','payload','SELECT *','DELETE ','UPDATE ','INSERT ']) {
        assert.ok(!sql.includes(forbidden), forbidden);
      }
      calls++;
      return { rows: [data({ ignored_user_id: 'PRIVATE' })] };
    } }
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'OUTBOX_RETENTION_STAGING_SNAPSHOT_OK');
  assert.equal(result.needsReview, true);
  assert.equal(result.pending_over_24h, 1);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.ok(!JSON.stringify(result).includes('synthetic-password'));
});

test('an empty outbox is measured successfully without implying retention approval', async () => {
  const r = await readRetentionSnapshot({
    env,
    ensureReady: async () => {},
    pool: { query: async () => ({ rows: [data({
      total: 0, pending: 0, sending: 0, dead_letter: 0,
      pending_over_15m: 0, pending_over_24h: 0,
      dead_letter_over_72h: 0, dead_letter_over_30d: 0,
      oldest_age_seconds: 0
    })] }) }
  });
  assert.equal(r.total, 0);
  assert.equal(r.needsReview, false);
  assert.ok(!Object.hasOwn(r, 'retentionApproved'));
});

test('invalid aggregates and driver errors reject safely without leaking database errors', async () => {
  for (const row of [
    data({ total: 999 }),
    data({ pending_over_24h: 3 }),
    data({ dead_letter_over_30d: 2 }),
    data({ oldest_age_seconds: -1 }),
    data({ pending: 'not-a-number' })
  ]) {
    await assert.rejects(readRetentionSnapshot({
      env, ensureReady: async () => {},
      pool: { query: async () => ({ rows: [row] }) }
    }), /OUTBOX_RETENTION_READONLY_FAILED/);
  }
  await assert.rejects(readRetentionSnapshot({
    env, ensureReady: async () => {},
    pool: { query: async () => { throw new Error('postgres password PRIVATE'); } }
  }), e => e.message === 'OUTBOX_RETENTION_READONLY_FAILED');
});

test('rejects enabled worker, production scope, primary database and invalid dependencies before SQL', async () => {
  for (const mod of [
    { AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'production' },
    { AUDIT_OUTBOX_WORKER_ENABLED: 'true' },
    { AUDIT_OUTBOX_ENABLED: 'true' },
    { DATABASE_URL: 'any' },
    { AUDIT_OUTBOX_PREFLIGHT_ONLY: 'false' }
  ]) {
    await assert.rejects(readRetentionSnapshot({
      env: { ...env, ...mod },
      ensureReady: async () => { throw new Error('must not run'); },
      pool: { query: async () => { throw new Error('must not run'); } }
    }), /OUTBOX_RETENTION_READONLY_REJECTED/);
  }
});

test('one-shot staging CLI validates scope, closes limited pool and never starts a worker', async () => {
  const actions = [];
  const snapshot = { status: 'OUTBOX_RETENTION_STAGING_SNAPSHOT_OK', total: 0 };
  const result = await checkStagingRetention({
    env,
    createDb: ({env: actual, standalonePreflight}) => {
      assert.equal(standalonePreflight, true);
      assert.equal(actual.AUDIT_OUTBOX_DEPLOYMENT_SCOPE, 'staging');
      assert.equal(actual.AUDIT_OUTBOX_DATABASE_URL, url);
      actions.push('pool');
      return { pool: { end: async () => actions.push('closed') },
        ensureReady: async () => {} };
    },
    snapshot: async () => { actions.push('snapshot'); return snapshot; }
  });
  assert.equal(result, snapshot);
  assert.deepEqual(actions, ['pool','snapshot','closed']);
  await assert.rejects(checkStagingRetention({
    env: { ...env, DATABASE_URL: 'postgres://should-never-be-used' },
    createDb: () => { throw new Error('must never construct pool'); }
  }), /AUDIT_RENDER_STAGING_ENV_REJECTED/);
});

test('one-shot CLI closes pool even if the read-only snapshot fails', async () => {
  let closed = false;
  await assert.rejects(checkStagingRetention({
    env,
    createDb: () => ({ pool: { end: async () => { closed = true; } },
      ensureReady: async () => {} }),
    snapshot: async () => { throw new Error('private-provider-url'); }
  }));
  assert.equal(closed, true);
});
