'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const http = require('node:http');
const {
  assertIsolatedStagingEnvironment,
  assertStagingDatabaseTarget,
  STAGING_PROJECT_ID
} = require('../staging/isolatedStagingGuard');
const { startIsolatedStaging, createReadinessHandler, STAGING_LISTEN_ADDRESS } =
  require('../staging/isolatedStagingServer');

const STAGING_USERNAME = 'demos_staging_runtime.' + STAGING_PROJECT_ID;
const testDbUrl = 'postgresql://' + STAGING_USERNAME +
  ':fake-only@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';

const baseEnv = () => ({
  NODE_ENV: 'production',
  DEMOS_DEPLOYMENT_SCOPE: 'isolated-staging',
  DEMOS_STAGING_PROJECT_ID: STAGING_PROJECT_ID,
  DEMOS_STAGING_CONFIRMATION: 'synthetic-only-no-prod-providers',
  DEMOS_STAGING_RUNTIME_PROFILE: 'readiness-only',
  PORT: '10000'
});

function rejected(overrides, code) {
  const env = { ...baseEnv(), ...overrides };
  for (const [k,v] of Object.entries(env)) if (v === undefined) delete env[k];
  assert.throws(
    () => assertIsolatedStagingEnvironment(env),
    err => err?.code === code && err.message === code &&
      !err.message.includes('fake-only')
  );
}

function rejectedUri(connectionString) {
  assert.throws(
    () => assertStagingDatabaseTarget(connectionString),
    err => err?.code === 'DEMOS_STAGING_DATABASE_TARGET_REJECTED' &&
      !err.message.includes('fake-only')
  );
}

test('readiness profile has no database credential and cannot claim GDPR readiness', () => {
  const result=assertIsolatedStagingEnvironment(baseEnv());
  assert.deepEqual(result,{
    scope:'isolated-staging',projectId:STAGING_PROJECT_ID,
    profile:'readiness-only',databaseConnected:false
  });
  assert.ok(Object.isFrozen(result));
  assert.equal(Object.hasOwn(result,'connectionString'),false);
  assert.equal(Object.hasOwn(result,'connectionKind'),false);
});

test('scope, project, explicit profile and node routing are mandatory', () => {
  for(const item of [
    {NODE_ENV:'staging'},{NODE_ENV:'development'},
    {DEMOS_DEPLOYMENT_SCOPE:undefined},{DEMOS_DEPLOYMENT_SCOPE:'production'},
    {DEMOS_STAGING_PROJECT_ID:'wxnblcqoyjqxktwkcqok'},
    {DEMOS_STAGING_PROJECT_ID:undefined},{DEMOS_STAGING_CONFIRMATION:undefined},
    {DEMOS_STAGING_RUNTIME_PROFILE:undefined},
    {DEMOS_STAGING_RUNTIME_PROFILE:'functional'}
  ]) rejected(item,'DEMOS_STAGING_SCOPE_REJECTED');
});

test('readiness-only boot rejects credentials INCLUDING a correctly scoped staging URI', () => {
  for(const key of ['DATABASE_URL','DATABASE_POOL_MAX','DATABASE_POOL_MIN',
      'STAGING_DATABASE_URL','DATABASE_PASSWORD','PGHOST']) {
    rejected({[key]:key==='DATABASE_URL'?testDbUrl:'2'},
      'DEMOS_STAGING_PROVIDER_ENV_REJECTED');
  }
});

test('every unknown provider token, worker flag and debugging option fails closed', () => {
  for (const key of [
    'FIREBASE_PRIVATE_KEY','FIREBASE_PROJECT_ID','FCM_SERVER_KEY',
    'AXIOM_API_TOKEN','B2_S3_SECRET_ACCESS_KEY','AWS_ACCESS_KEY_ID',
    'REDIS_URL','UPSTASH_REDIS_REST_TOKEN','SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY','JWT_SECRET','GOOGLE_APPLICATION_CREDENTIALS',
    'ENABLE_CIVIC_PROCESS_SYNC','AXIOM_ARCHIVE_ENABLED','NODE_OPTIONS',
    'ALLOW_DEV_API_SURFACE','PERFORMANCE_MONITOR_ENABLED','LOG_LEVEL'
  ]) rejected({[key]:'anything'},'DEMOS_STAGING_PROVIDER_ENV_REJECTED');
});

test('listen port must be a valid explicit decimal TCP port', () => {
  for(const value of [undefined,'','0','00080','-1','65536','100000','ABC']) {
    rejected({PORT:value},'DEMOS_STAGING_SIDE_EFFECTS_REJECTED');
  }
});

test('future SQL validator accepts only the staging direct URI and future runtime role', () => {
  const url='postgresql://demos_staging_runtime:fake-only@db.' +
    STAGING_PROJECT_ID+'.supabase.co:5432/postgres?sslmode=require';
  assert.deepEqual(assertStagingDatabaseTarget(url),{
    projectId:STAGING_PROJECT_ID,connectionKind:'supabase-direct'
  });
  assert.ok(Object.isFrozen(assertStagingDatabaseTarget(url)));
  rejectedUri(url.replace(STAGING_PROJECT_ID,'wxnblcqoyjqxktwkcqok'));
});

test('future SQL pooler validator binds credentials to staging project reference', () => {
  assert.deepEqual(assertStagingDatabaseTarget(testDbUrl),{
    projectId:STAGING_PROJECT_ID,connectionKind:'supabase-pooler'
  });
  const transaction=testDbUrl.replace(':5432/',':6543/')+'&pgbouncer=true';
  assert.equal(assertStagingDatabaseTarget(transaction).connectionKind,'supabase-pooler');
});

test('future SQL target validator rejects other projects, roles, ports and overrides', () => {
  for (const url of [
    undefined,'not-a-uri',
    'postgresql://postgres.wxnblcqoyjqxktwkcqok:fake@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    'postgresql://postgres:fake@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    'postgresql://demos_staging_runtime:fake@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    'postgresql://'+STAGING_USERNAME+':fake@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
    'postgresql://'+STAGING_USERNAME+':fake@aws-1-eu-central-1.pooler.supabase.com:5433/postgres',
    'postgresql://'+STAGING_USERNAME+':fake@aws-1-eu-central-1.pooler.supabase.com:5432/demos',
    'postgresql://'+STAGING_USERNAME+':fake@db.wxnblcqoyjqxktwkcqok.supabase.co:5432/postgres',
    'postgresql://'+STAGING_USERNAME+':fake@127.0.0.1:5432/postgres',
    'postgresql://'+STAGING_USERNAME+':fake@aws-1-eu-central-1.pooler.supabase.com:5432/postgres#override',
    'postgresql://'+STAGING_USERNAME+'@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    testDbUrl+'&options=-csearch_path%3Dpublic',
    testDbUrl.replace('?sslmode=require',''),
    testDbUrl.replace('?sslmode=require','?pgbouncer=true'),
    'postgresql://demos_staging_runtime:fake-only@db.' +
      STAGING_PROJECT_ID + '.supabase.co:5432/postgres',
    testDbUrl.replace('sslmode=require','sslmode=prefer'),
    testDbUrl.replace('sslmode=require','sslmode=disable'),
    testDbUrl+'&sslmode=require',
    testDbUrl+'&pgbouncer=true&pgbouncer=true'
  ]) rejectedUri(url);
});

test('failed startup does not even create the local HTTP service', () => {
  let launches=0;
  const launch=()=>{launches++;};
  assert.throws(
    ()=>startIsolatedStaging({env:{...baseEnv(),DATABASE_URL:testDbUrl},launch}),
    error=>error.code==='DEMOS_STAGING_PROVIDER_ENV_REJECTED'
  );
  assert.equal(launches,0);
  assert.deepEqual(startIsolatedStaging({env:baseEnv(),launch}),{
    scope:'isolated-staging',projectId:STAGING_PROJECT_ID,
    profile:'readiness-only',databaseConnected:false
  });
  assert.equal(launches,1);
});

test('free CI readiness can only bind loopback; no public listener may be started', () => {
  const original = http.createServer;
  const recorded = [];
  http.createServer = () => ({
    on(event) {
      assert.equal(event,'error');
      return this;
    },
    listen(port,host) {
      recorded.push({port,host});
      return this;
    }
  });
  try {
    assert.equal(STAGING_LISTEN_ADDRESS, '127.0.0.1');
    const attestation = startIsolatedStaging({env:baseEnv()});
    assert.equal(attestation.databaseConnected,false);
    assert.deepEqual(recorded,[{port:10000,host:'127.0.0.1'}]);
  } finally {
    http.createServer = original;
  }
});

test('real CLI denies credential-bearing staging before boot with no secret disclosure', () => {
  const result=spawnSync(process.execPath,['staging/isolatedStagingServer.js'],{
    cwd:path.resolve(__dirname,'..'),
    env:{...baseEnv(),DATABASE_URL:testDbUrl},
    encoding:'utf8',timeout:5000
  });
  assert.equal(result.status,1);
  assert.match(result.stderr,/DEMOS_STAGING_BOOT_REJECTED/);
  assert.doesNotMatch(result.stderr,/fake-only|DATABASE_URL|pooler\.supabase/);
});

test('normal app cannot run using isolated staging flag and bypass readiness-only', () => {
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const guard=app.indexOf('assertIsolatedStagingEnvironment(process.env)');
  const forbidden=app.indexOf('DEMOS_STAGING_FULL_APP_NOT_AUTHORIZED');
  const express=app.indexOf("const express = require('express')");
  assert.ok(guard>=0 && forbidden>guard && express>forbidden,
    'full app MUST reject staging before importing Express/providers');
  const entry=fs.readFileSync(
    path.join(__dirname,'..','staging','isolatedStagingServer.js'),'utf8');
  assert.doesNotMatch(entry,/require\(['"]\.\.\/(?:server|app)['"]\)/);
});

test('readiness server returns only fixed no-data health and denies application routes', async t => {
  const server=http.createServer(createReadinessHandler());
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const health=await fetch(base+'/__staging/health');
  assert.equal(health.status,200);
  assert.equal(health.headers.get('cache-control'),'no-store');
  assert.deepEqual(await health.json(),{
    status:'preflight-only',gdprReady:false,
    databaseConnected:false,externalProvidersConnected:false
  });
  for (const endpoint of [
    '/api/health','/api/auth/login','/api/sondaggi','/api/avvistamenti',
    '/api/admin/database','/api/user/delete-account','/__staging/health?debug=true'
  ]) {
    const response=await fetch(base+endpoint);
    assert.equal(response.status,404,endpoint);
    assert.deepEqual(await response.json(),{error:'not_found'},endpoint);
  }
  const mutation=await fetch(base+'/__staging/health',{method:'POST'});
  assert.equal(mutation.status,404);
  assert.deepEqual(await mutation.json(),{error:'not_found'});
});


test('real credentialless CLI serves only readiness on a TCP port and stops cleanly', async t => {
  const net = require('node:net');
  const { spawn } = require('node:child_process');
  const reservation = net.createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = String(reservation.address().port);
  await new Promise((resolve, reject) =>
    reservation.close(err => err ? reject(err) : resolve()));

  // Never inherit CI or provider credentials into a child process.
  const env = { ...baseEnv(), PORT: port };
  const child = spawn(process.execPath, ['staging/isolatedStagingServer.js'], {
    cwd: path.resolve(__dirname, '..'), env, stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', part => { stderr += part.slice(0, 1500); });
  const exited = new Promise(resolve => child.once('exit',
    (code, signal) => resolve({ code, signal })));
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGTERM');
    await exited;
  });

  const base = 'http://127.0.0.1:' + port;
  let health = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) break;
    try {
      health = await fetch(base + '/__staging/health', {
        signal: AbortSignal.timeout(300)
      });
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }
  assert.ok(health, 'entrypoint must serve the readiness route; ' +
    (stderr.includes('DEMOS_STAGING_BOOT_REJECTED') ? 'boot-rejected' : 'no-response'));
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await health.json(), {
    status: 'preflight-only', gdprReady: false,
    databaseConnected: false, externalProvidersConnected: false
  });
  for (const [endpoint, method] of [
    ['/api/auth/login', 'GET'],
    ['/api/user/delete-account', 'GET'],
    ['/api/sondaggi', 'POST']
  ]) {
    const denied = await fetch(base + endpoint, { method });
    assert.equal(denied.status, 404, endpoint);
    assert.deepEqual(await denied.json(), { error: 'not_found' }, endpoint);
  }
});
