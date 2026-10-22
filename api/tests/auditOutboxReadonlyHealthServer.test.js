'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { healthHandler, waitingHandler, safeStagingConfigurationCode, safeStartupFailureCode, startupStatus, startReadonlyHealthServer } =
  require('../scripts/audit-outbox-readonly-health-server');

const staging = 'fkeayjzvtuvzesljhjbc';
const host = 'aws-1-eu-central-1.pooler.supabase.com';
const base = {
  AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'staging',
  AUDIT_OUTBOX_PREFLIGHT_ONLY: 'true',
  AUDIT_OUTBOX_DATABASE_URL:
    `postgresql://demos_outbox_runtime.${staging}:synthetic-only@${host}:5432/postgres`,
  AXIOM_REALTIME_DATASET: 'demos-security-staging',
  AXIOM_DATASET: 'demos-security-staging',
  AXIOM_ARCHIVE_ENABLED: 'false',
  AUDIT_OUTBOX_ENABLED: 'false',
  AUDIT_OUTBOX_WORKER_ENABLED: 'false',
  AUDIT_OUTBOX_SECURITY_ENABLED: 'false',
  AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED: 'false',
  PORT: '10000'
};

test('health server validates isolated staging and successful DB preflight before binding', async () => {
  const actions = [];
  const instance = await startReadonlyHealthServer({
    env: base,
    verify: async () => {
      actions.push('verified');
      return {
        result: 'AUDIT_RENDER_STAGING_PREFLIGHT_OK',
        outboxEnabled: false,
        archiveEnabled: false
      };
    },
    serve: (handler, port) => {
      assert.equal(port, 10000);
      assert.equal(typeof handler, 'function');
      actions.push('bound');
      return { running: true };
    }
  });
  assert.deepEqual(actions, ['verified', 'bound']);
  assert.deepEqual(instance, { running: true });
});

test('unconfigured staging service starts safely without a DB secret', async () => {
  let verified = false;
  let listener;
  const runtime = await startReadonlyHealthServer({
    env: { ...base, AUDIT_OUTBOX_DATABASE_URL: undefined },
    verify: async () => { verified = true; throw new Error('must not connect'); },
    serve: (handler, port) => { listener = handler; return { port }; }
  });
  assert.equal(verified, false);
  assert.deepEqual(runtime, { port: 10000 });
  assert.equal(listener, waitingHandler);
  const health = response();
  waitingHandler({ method: 'GET', url: '/healthz' }, health);
  assert.equal(health.output.status, 503);
  assert.equal(health.output.body, 'not ready\n');
  const landing = response();
  waitingHandler({ method: 'GET', url: '/' }, landing);
  assert.equal(landing.output.status, 200);
  assert.equal(landing.output.body, 'staging probe pending configuration\n');
  let opened = false;
  await assert.rejects(startReadonlyHealthServer({
    env: { ...base, AUDIT_OUTBOX_DATABASE_URL: undefined, DATABASE_URL: 'not-allowed' },
    verify: async () => { throw new Error('must not connect'); },
    serve: () => { opened = true; }
  }), /AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED/);
  assert.equal(opened, false);
});

test('log status never reports success when the service has no database credential', () => {
  assert.equal(startupStatus({}),
    'AUDIT_RENDER_STAGING_STANDBY_NO_DB_SECRET');
  assert.equal(startupStatus({ AUDIT_OUTBOX_DATABASE_URL: base.AUDIT_OUTBOX_DATABASE_URL }),
    'AUDIT_RENDER_STAGING_PREFLIGHT_OK');
});

test('diagnostics emit only constant codes and never database driver strings', () => {
  assert.equal(safeStartupFailureCode(new Error('AUDIT_RENDER_STAGING_ENV_REJECTED'), base),
    'AUDIT_RENDER_STAGING_CONFIGURATION_REJECTED');
  assert.equal(safeStartupFailureCode(new Error('AUDIT_STAGING_TARGET_REJECTED'), base),
    'AUDIT_RENDER_STAGING_CONFIGURATION_REJECTED');
  assert.equal(safeStartupFailureCode(new Error('AUDIT_OUTBOX_DATABASE_PREFLIGHT_FAILED')),
    'AUDIT_RENDER_STAGING_DATABASE_CONNECTION_REJECTED');
  assert.equal(safeStartupFailureCode(new Error('postgres://user:secret@host:5432/postgres')),
    'AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED');
  assert.doesNotMatch(safeStartupFailureCode({ message: 'private password secret' }), /secret|password|postgres:/i);
});

test('staging configuration reasons expose no URL values or credentials', () => {
  const tests = [
    [{ ...base, AUDIT_OUTBOX_PREFLIGHT_ONLY: 'false' }, 'AUDIT_RENDER_CONFIG_FLAGS_REJECTED'],
    [{ ...base, DATABASE_URL: 'not-for-staging' }, 'AUDIT_RENDER_CONFIG_PRIMARY_DB_FORBIDDEN'],
    [{ ...base, AUDIT_OUTBOX_DATABASE_URL: '' }, 'AUDIT_RENDER_CONFIG_OUTBOX_URL_MISSING'],
    [{ ...base, AUDIT_OUTBOX_DATABASE_URL: 'not-a-url' }, 'AUDIT_RENDER_CONFIG_URL_INVALID'],
    [{ ...base, AUDIT_OUTBOX_DATABASE_URL: base.AUDIT_OUTBOX_DATABASE_URL.replace('synthetic-only@', '@') },
      'AUDIT_RENDER_CONFIG_PASSWORD_MISSING'],
    [{ ...base, AUDIT_OUTBOX_DATABASE_URL: base.AUDIT_OUTBOX_DATABASE_URL.replace('demos_outbox_runtime.', 'postgres.') },
      'AUDIT_RENDER_CONFIG_ROLE_REJECTED'],
    [{ ...base, AUDIT_OUTBOX_DATABASE_URL: base.AUDIT_OUTBOX_DATABASE_URL.replace(host, 'aws-0-eu-central-1.pooler.supabase.com') },
      'AUDIT_RENDER_CONFIG_ENDPOINT_REJECTED']
  ];
  for (const [env, code] of tests) {
    assert.equal(safeStagingConfigurationCode(env), code);
    assert.doesNotMatch(code, /synthetic-only|postgresql:|aws-0/);
  }
  assert.equal(safeStagingConfigurationCode(base), 'AUDIT_RENDER_STAGING_CONFIGURATION_REJECTED');
});

test('unsafe environment and failed readiness never open a public listener', async () => {
  for (const env of [
    { ...base, DATABASE_URL: base.AUDIT_OUTBOX_DATABASE_URL },
    { ...base, AUDIT_OUTBOX_WORKER_ENABLED: 'true' },
    { ...base, AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'production' },
    { ...base, AUDIT_OUTBOX_DATABASE_URL: base.AUDIT_OUTBOX_DATABASE_URL.replace(host, 'aws-0-eu-central-1.pooler.supabase.com') },
    { ...base, PORT: '70000' },
    { ...base, PORT: '-1' }
  ]) {
    let opened = false;
    await assert.rejects(
      startReadonlyHealthServer({
        env, verify: async () => { throw new Error('must never verify'); },
        serve: () => { opened = true; }
      })
    );
    assert.equal(opened, false);
  }
  let opened = false;
  await assert.rejects(
    startReadonlyHealthServer({
      env: base,
      verify: async () => ({ result: 'AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED' }),
      serve: () => { opened = true; }
    }),
    /AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED/
  );
  assert.equal(opened, false);
});

function response() {
  const output = { status: 0, headers: null, body: '' };
  return {
    output,
    writeHead(status, headers) {
      output.status = status;
      output.headers = headers;
    },
    end(body) {
      output.body = body;
    }
  };
}

test('only GET /healthz is publicly accessible, without any metadata', () => {
  for (const request of [
    { method: 'GET', url: '/' },
    { method: 'POST', url: '/healthz' },
    { method: 'GET', url: '/admin' },
    { method: 'GET', url: '/healthz?debug=true' }
  ]) {
    const r = response();
    healthHandler(request, r);
    assert.equal(r.output.status, 404);
    assert.equal(r.output.body, 'not found\n');
  }
  const r = response();
  healthHandler({ method: 'GET', url: '/healthz' }, r);
  assert.equal(r.output.status, 200);
  assert.equal(r.output.body, 'ok\n');
  assert.equal(r.output.headers['cache-control'], 'no-store');
});
