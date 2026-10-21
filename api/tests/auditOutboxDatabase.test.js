'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuditOutboxDatabase } = require('../services/auditOutboxDatabase');

const local = 'postgresql://audit_user:ci-secret@127.0.0.1:5432/demos_outbox_ci';
const role = Object.freeze({
  is_superuser: false, bypass_rls: false, can_login: true,
  worker_member: true, schema_access: true,
  can_select: true, can_insert: true, can_update: true,
  can_delete: true, rls_enabled: true
});

function fixture({ resultRole = role, environment = {}, failFirst = false } = {}) {
  const queries = [];
  let calls = 0;
  const captured = [];
  class StubPool {
    constructor(config) {
      captured.push(config);
    }
    async query(sql, args) {
      queries.push({ sql, args });
      calls++;
      if (failFirst && calls === 1) throw new Error('postgres://leaked-username:password@secret');
      return { rows: resultRole ? [resultRole] : [] };
    }
  }
  const env = { NODE_ENV: 'test', AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'ci-only',
    AUDIT_OUTBOX_DATABASE_URL: local,
    DATABASE_URL: 'postgresql://main_user:ci-password@127.0.0.1:5432/demos_outbox_ci',
    ...environment };
  return {
    get: () => createAuditOutboxDatabase({ env, PoolClass: StubPool, ca: () => 'CA-TEST-ONLY' }),
    queries,
    captured
  };
}

test('default: dedicated URL is mandatory and cannot equal general DEMOS DB URL', () => {
  assert.throws(
    () => createAuditOutboxDatabase({ env: { DATABASE_URL: local, AUDIT_OUTBOX_DATABASE_URL: local } }),
    /MUST_BE_DISTINCT/
  );
  assert.throws(
    () => createAuditOutboxDatabase({ env: {} }), /DATABASE_URL_REQUIRED/
  );
  assert.throws(
    () => createAuditOutboxDatabase({ env: { AUDIT_OUTBOX_DATABASE_URL: 'https://not-postgres' } }),
    /DATABASE_URL_INVALID/
  );
});

test('dedicated pool is small, TLS-aware, and checks Postgres membership before use', async () => {
  const f = fixture();
  const { pool, ensureReady } = f.get();
  assert.ok(pool);
  assert.equal(f.captured.length, 1);
  assert.equal(f.captured[0].max, 2);
  assert.equal(f.captured[0].min, 0);
  assert.equal(f.captured[0].ssl, false, 'loopback CI uses no TLS');
  await ensureReady();
  await ensureReady();
  assert.equal(f.queries.length, 1, 'ready check cached');
  assert.deepEqual(f.queries[0].args, ['demos_outbox_worker']);
  assert.ok(f.queries[0].sql.includes('pg_has_role'));
  assert.ok(!JSON.stringify(f.queries).includes('ci-secret'));
});

test('Supabase connection has verified TLS and ignores untrusted sslmode URL override', async () => {
  const f = fixture({
    environment: {
      DATABASE_URL:
        'postgresql://postgres:staging-test-secret@db.fkeayjzvtuvzesljhjbc.supabase.co:5432/postgres',
      AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'staging',
      AUDIT_OUTBOX_DATABASE_URL:
        'postgresql://demos_outbox_runtime:staging-secret@db.fkeayjzvtuvzesljhjbc.supabase.co:5432/postgres?sslmode=disable'
    }
  });
  f.get();
  assert.deepEqual(f.captured[0].ssl, { rejectUnauthorized: true, ca: 'CA-TEST-ONLY' });
  assert.ok(!f.captured[0].connectionString.includes('sslmode=disable'));
});

test('preflight denies owner/bypass/admin permissions, missing grants and absent policy', async () => {
  for (const extra of [
    { is_superuser: true }, { bypass_rls: true }, { worker_member: false },
    { can_insert: false }, { rls_enabled: false }, { can_login: false }
  ]) {
    const f = fixture({ resultRole: { ...role, ...extra } });
    await assert.rejects(() => f.get().ensureReady(), /DATABASE_PREFLIGHT_FAILED/);
  }
  const f = fixture({ resultRole: null });
  await assert.rejects(() => f.get().ensureReady(), /DATABASE_PREFLIGHT_FAILED/);
});

test('preflight errors never disclose the connection string; transient failures can retry', async () => {
  const f = fixture({ failFirst: true });
  const db = f.get();
  await assert.rejects(
    () => db.ensureReady(),
    e => e.message === 'AUDIT_OUTBOX_DATABASE_PREFLIGHT_FAILED'
  );
  await db.ensureReady();
  assert.equal(f.queries.length, 2);
});

test('no pool connection happens when URL is missing or identical to the main connection', () => {
  const f = fixture({ environment: { AUDIT_OUTBOX_DATABASE_URL: '' } });
  assert.throws(() => f.get(), /DATABASE_URL_REQUIRED/);
  assert.equal(f.captured.length, 0);
});

test('cross-project or incorrect deployment scope rejects before constructing any pool', () => {
  const stagingMain =
    'postgresql://postgres:ci@db.fkeayjzvtuvzesljhjbc.supabase.co:5432/postgres';
  const stagingOutbox =
    'postgresql://demos_outbox_runtime:ci@db.fkeayjzvtuvzesljhjbc.supabase.co:5432/postgres';
  const prodMain =
    'postgresql://postgres:ci@db.wxnblcqoyjqxktwkcqok.supabase.co:5432/postgres';
  for (const environment of [
    {
      DATABASE_URL: prodMain, AUDIT_OUTBOX_DATABASE_URL: stagingOutbox,
      AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'production'
    },
    {
      DATABASE_URL: stagingMain, AUDIT_OUTBOX_DATABASE_URL: stagingOutbox,
      AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'production'
    },
    {
      DATABASE_URL: stagingMain, AUDIT_OUTBOX_DATABASE_URL: stagingOutbox,
      AUDIT_OUTBOX_DEPLOYMENT_SCOPE: ''
    }
  ]) {
    const f = fixture({ environment });
    assert.throws(() => f.get(), /PROJECT_SCOPE_REJECTED/);
    assert.equal(f.captured.length, 0);
    assert.equal(f.queries.length, 0);
  }
});
