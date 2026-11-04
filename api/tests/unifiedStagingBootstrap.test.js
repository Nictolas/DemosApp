'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  validateBootstrapEnvironment,
  createBootstrapServer,
} = require('../staging/unified_staging_bootstrap');

async function withBootstrap(t) {
  // Loopback only: no Render, Supabase, Firebase, Redis or production I/O.
  const server = createBootstrapServer();
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;

  return (path, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ code: res.statusCode, body, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('requires explicit non-production bootstrap authorization', () => {
  assert.throws(
    () => validateBootstrapEnvironment({ NODE_ENV: 'production', DEMOS_UNIFIED_STAGING_MODE: 'bootstrap' }),
    /explicit non-production/
  );
  assert.throws(
    () => validateBootstrapEnvironment({ NODE_ENV: 'staging' }),
    /explicit non-production/
  );
  assert.throws(
    () => validateBootstrapEnvironment({ NODE_ENV: 'staging', DEMOS_UNIFIED_STAGING_MODE: 'application' }),
    /explicit non-production/
  );
  assert.deepEqual(
    validateBootstrapEnvironment({ NODE_ENV: 'staging', DEMOS_UNIFIED_STAGING_MODE: 'bootstrap', PORT: '10000' }),
    { port: 10000 }
  );
});

test('bootstrap refuses sensitive provider configuration before opening any listener', () => {
  const safe = { NODE_ENV: 'staging', DEMOS_UNIFIED_STAGING_MODE: 'bootstrap' };
  const keys = [
    'DATABASE_URL', 'DIRECT_URL', 'PGHOST', 'PGUSER', 'PGPASSWORD',
    'SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'REDIS_URL', 'AXIOM_API_TOKEN', 'B2_S3_ACCESS_KEY_ID',
    'B2_S3_SECRET_ACCESS_KEY', 'B2_APPLICATION_KEY',
    'GDPR_LEDGER_B2_ACCESS_KEY_ID', 'GDPR_LEDGER_B2_SECRET_ACCESS_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT',
    'FIREBASE_SERVICE_ACCOUNT_JSON',
  ];
  for (const key of keys) {
    assert.throws(
      () => validateBootstrapEnvironment({ ...safe, [key]: 'synthetic-never-connect' }),
      /STAGING_BOOTSTRAP_CREDENTIALS_FORBIDDEN/, key
    );
  }
  for (const key of [
    'CIVIC_PUSH_ENABLED', 'AXIOM_ARCHIVE_ENABLED',
    'GDPR_LEDGER_B2_ENABLED', 'GDPR_ERASURE_OUTBOX_WORKER_ENABLED',
    'PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED', 'PARLIAMENT_FINAL_PUSH_ENABLED',
    'CIVIC_STAGING_SESSION_CHECK_APPLY',
    'CIVIC_UNIFIED_STAGING_READY', 'CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED',
  ]) {
    for (const active of ['true', 'TRUE', ' true ', '1', 'yes', 'ON']) {
      assert.throws(
        () => validateBootstrapEnvironment({ ...safe, [key]: active }),
        /STAGING_BOOTSTRAP_ACTIVE_FLAGS_FORBIDDEN/, key + '=' + active
      );
    }
  }
  assert.deepEqual(validateBootstrapEnvironment({
    ...safe, DATABASE_URL: '', AXIOM_API_TOKEN: '  ',
    CIVIC_PUSH_ENABLED: 'false',
  }), { port: 10000 });
});

test('rejects ephemeral, non-decimal, and out-of-range deployed ports', () => {
  const env = { NODE_ENV: 'staging', DEMOS_UNIFIED_STAGING_MODE: 'bootstrap' };
  assert.deepEqual(validateBootstrapEnvironment(env), { port: 10000 });
  for (const invalid of ['0', '-1', '65536', '0x2710', '1e4', ' 10000', '10000 ', '10000.0', 'NaN', 'Infinity', '000000']) {
    assert.throws(
      () => validateBootstrapEnvironment({ ...env, PORT: invalid }),
      /Invalid bootstrap port/,
      `Unexpectedly accepted PORT=${invalid}`
    );
  }
  for (const allowed of ['1', '80', '65535']) {
    assert.equal(validateBootstrapEnvironment({ ...env, PORT: allowed }).port, Number(allowed));
  }
});

test('bootstrap exposes no app route and is never application-ready', async t => {
  const request = await withBootstrap(t);
  for (const path of ['/health', '/health/live']) {
    const response = await request(path);
    assert.equal(response.code, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'bootstrap_only');
    assert.equal(body.environment, 'staging');
    assert.equal(body.ready_for_app_tests, false);
    assert.equal(body.database_connected, false);
    assert.equal(body.production_access, false);
    assert.equal(body.notifications_enabled, false);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'DENY');
  }
  const ready = await request('/health/ready');
  assert.equal(ready.code, 503);
  assert.equal(JSON.parse(ready.body).status, 'not_ready');
  assert.equal(ready.headers['cache-control'], 'no-store');

  for (const path of [
    '/api/notifiche', '/api/auth/login', '/api/v1/opinioni',
    '/api/users', '/metrics', '/debug', '/', '/admin', '/healthz',
  ]) {
    const response = await request(path);
    assert.equal(response.code, 404, `Unexpected application route enabled: ${path}`);
    assert.deepEqual(JSON.parse(response.body), { error: 'not_found' });
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await request('/health', method);
    assert.equal(response.code, 405);
    assert.deepEqual(JSON.parse(response.body), { error: 'method_not_allowed' });
  }
});

test('refuses absolute and network-path request targets', async t => {
  const request = await withBootstrap(t);
  for (const path of ['http://untrusted.invalid/health', '//untrusted.invalid/health']) {
    const response = await request(path);
    assert.equal(response.code, 400, `Accepted untrusted request target: ${path}`);
    assert.deepEqual(JSON.parse(response.body), { error: 'invalid_request_target' });
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  assert.equal((await request('/health/ready?ready=true')).code, 503);
  assert.equal((await request('/api/../api/notifiche')).code, 404);
});

test('never reflects authorization values or query parameters', async t => {
  const request = await withBootstrap(t);
  const secret = 'synthetic-not-a-real-token';
  const response = await request(`/health?access_token=${secret}`, 'GET', {
    authorization: `Bearer ${secret}`,
    'x-api-key': secret,
  });
  assert.equal(response.code, 200);
  assert.equal(response.body.includes(secret), false);
  assert.equal(JSON.stringify(response.headers).includes(secret), false);
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('preflight start via unchanged Render command never launches bootstrap', async () => {
  const {startConfiguredStaging}=require('../staging/unified_staging_bootstrap');
  const env={NODE_ENV:'staging',DEMOS_UNIFIED_STAGING_MODE:'preflight'};
  let preflightCalls=0;
  const marker={mode:'preflight',status:'not_app_ready'};
  const result=await startConfiguredStaging(env,{
    bootstrap:()=>{throw new Error('must not fall back to bootstrap');},
    preflight:async actual=>{
      preflightCalls++;
      assert.equal(actual,env);
      return marker;
    },
  });
  assert.equal(result,marker);
  assert.equal(preflightCalls,1);
});

test('default bootstrap and invalid mode cannot silently import or use preflight', async () => {
  const {startConfiguredStaging}=require('../staging/unified_staging_bootstrap');
  for(const mode of ['application',undefined]) {
    let preflightCalls=0,bootstrapCalls=0;
    const env={NODE_ENV:'staging',DEMOS_UNIFIED_STAGING_MODE:mode};
    await assert.rejects(startConfiguredStaging(env,{
      bootstrap:actual=>{
        bootstrapCalls++;
        validateBootstrapEnvironment(actual);
      },
      preflight:()=>{
        preflightCalls++;
        throw new Error('wrongly called preflight');
      }
    }),/explicit non-production/);
    assert.equal(preflightCalls,0);
    assert.equal(bootstrapCalls,1);
  }
  const good={NODE_ENV:'staging',DEMOS_UNIFIED_STAGING_MODE:'bootstrap',PORT:'10000'};
  let preflightCalls=0;
  const marker={mode:'bootstrap'};
  assert.equal(await startConfiguredStaging(good,{
    bootstrap:actual=>{
      assert.equal(actual,good);
      return marker;
    },
    preflight:()=>{preflightCalls++; throw new Error('wrong preflight route');},
  }),marker);
  assert.equal(preflightCalls,0);
});

test('preflight errors never fall back to bootstrap listener', async()=>{
  const {startConfiguredStaging}=require('../staging/unified_staging_bootstrap');
  let boot=0;
  await assert.rejects(startConfiguredStaging({
    NODE_ENV:'staging',DEMOS_UNIFIED_STAGING_MODE:'preflight',
  },{
    preflight:async()=>{throw new Error('synthetic preflight refused');},
    bootstrap:()=>{boot++; throw new Error('wrong path');},
  }),/synthetic preflight refused/);
  assert.equal(boot,0);
});
