'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FORBIDDEN_ENABLED_FLAGS,
  assertSafeRenderStagingEnvironment,
  runRenderStagingReadiness
} = require('../services/auditOutboxRenderStagingReadiness');

const staging = 'fkeayjzvtuvzesljhjbc';
const production = 'wxnblcqoyjqxktwkcqok';
const main = `postgres://postgres.${staging}:test-password@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`;
const dedicated = `postgres://demos_outbox_runtime.${staging}:test-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`;
const base = Object.freeze({
  NODE_ENV: 'production',
  DATABASE_URL: main,
  AUDIT_OUTBOX_DATABASE_URL: dedicated,
  AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'staging',
  AXIOM_REALTIME_DATASET: 'demos-security-staging',
  AXIOM_DATASET: 'demos-security-staging',
  AXIOM_ARCHIVE_ENABLED: 'false',
  AUDIT_OUTBOX_ENABLED: 'false',
  AUDIT_OUTBOX_WORKER_ENABLED: 'false',
  AUDIT_OUTBOX_SECURITY_ENABLED: 'false',
  AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED: 'false'
});

test('safe staging env accepts only same staging project with dedicated 5432 outbox URL', () => {
  assert.deepEqual(assertSafeRenderStagingEnvironment(base),
    { stagingRef: staging, mode: 'session-pooler' });
  assert.doesNotThrow(() => assertSafeRenderStagingEnvironment({
    ...base,
    AUDIT_OUTBOX_DATABASE_URL:
      `postgresql://demos_outbox_runtime:test-password@db.${staging}.supabase.co:5432/postgres`
  }));
});

test('unsafe Render config is denied before a database preflight runs', async () => {
  const unsafeCases = [
    { AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'production' },
    { DATABASE_URL: main.replace(staging, production) },
    { AUDIT_OUTBOX_DATABASE_URL: dedicated.replace(staging, production) },
    { AUDIT_OUTBOX_DATABASE_URL: main },
    { AUDIT_OUTBOX_DATABASE_URL: dedicated.replace(':5432/', ':6543/') },
    { AUDIT_OUTBOX_DATABASE_URL: undefined },
    { DATABASE_URL: undefined },
    { AXIOM_REALTIME_DATASET: 'real-time' },
    { AXIOM_DATASET: 'centralized_logs' },
    ...FORBIDDEN_ENABLED_FLAGS.map(key => ({ [key]: 'true' }))
  ];
  for (const changes of unsafeCases) {
    let preflightCalled = false;
    await assert.rejects(
      () => runRenderStagingReadiness({
        env: { ...base, ...changes },
        preflight: async () => { preflightCalled = true; throw new Error('must not run'); }
      }),
      error => error.message === 'AUDIT_RENDER_STAGING_ENV_REJECTED',
      JSON.stringify(Object.keys(changes))
    );
    assert.equal(preflightCalled, false);
  }
});

test('read-only verified preflight returns only safe metadata, not database URL', async () => {
  let calls = 0;
  const result = await runRenderStagingReadiness({
    env: base,
    preflight: async () => {
      calls++;
      return { stagingRef: staging, roleAuthorized: true, readOnly: true };
    }
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, {
    result: 'AUDIT_RENDER_STAGING_PREFLIGHT_OK',
    stagingRef: staging,
    readOnly: true,
    outboxEnabled: false,
    archiveEnabled: false
  });
  assert.doesNotMatch(JSON.stringify(result), /test-password|postgres:\/\//);
});

test('wrong project, unauthorized role or non-readonly result rejects a preflight', async () => {
  for (const result of [
    { stagingRef: production, roleAuthorized: true, readOnly: true },
    { stagingRef: staging, roleAuthorized: false, readOnly: true },
    { stagingRef: staging, roleAuthorized: true, readOnly: false },
    null
  ]) {
    await assert.rejects(
      () => runRenderStagingReadiness({ env: base, preflight: async () => result }),
      error => error.message === 'AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED'
    );
  }
});
