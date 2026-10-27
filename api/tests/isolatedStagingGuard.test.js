'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertIsolatedStagingEnvironment, STAGING_PROJECT_ID } =
  require('../staging/isolatedStagingGuard');
const { startIsolatedStaging, createReadinessHandler } =
  require('../staging/isolatedStagingServer');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const STAGING_USERNAME = 'demos_staging_runtime.' + STAGING_PROJECT_ID;
const baseEnv = () => ({
  NODE_ENV: 'production',
  DEMOS_DEPLOYMENT_SCOPE: 'isolated-staging',
  DEMOS_STAGING_PROJECT_ID: STAGING_PROJECT_ID,
  DEMOS_STAGING_CONFIRMATION: 'synthetic-only-no-prod-providers',
  DATABASE_URL: 'postgresql://' + STAGING_USERNAME +
    ':synthetic-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require',
  DATABASE_POOL_MAX: '2',
  DATABASE_POOL_MIN: '0',
  PERFORMANCE_MONITOR_ENABLED: 'false',
  ALLOW_DEV_API_SURFACE: 'false',
  PORT: '10000'
});

function rejected(overrides, code) {
  const env = { ...baseEnv(), ...overrides };
  for (const [k,v] of Object.entries(env)) if (v === undefined) delete env[k];
  assert.throws(
    () => assertIsolatedStagingEnvironment(env),
    err => err?.code === code && err.message === code &&
      !err.message.includes('synthetic-password')
  );
}

test('only the exact staging Supabase pooler identity and bounded pool may boot', () => {
  const attestation = assertIsolatedStagingEnvironment(baseEnv());
  assert.deepEqual(attestation, {
    scope:'isolated-staging',
    projectId:STAGING_PROJECT_ID,
    connectionKind:'supabase-pooler',
    poolMax:2
  });
  assert.equal(Object.hasOwn(attestation,'connectionString'),false);
  assert.ok(Object.isFrozen(attestation));
});

test('direct staging endpoint also requires exact project, role and /postgres', () => {
  const env = baseEnv();
  env.DATABASE_URL = 'postgresql://demos_staging_runtime:fake-only@db.' +
    STAGING_PROJECT_ID + '.supabase.co:5432/postgres';
  assert.equal(assertIsolatedStagingEnvironment(env).connectionKind, 'supabase-direct');
  rejected({ DATABASE_URL:env.DATABASE_URL.replace(STAGING_PROJECT_ID,'wxnblcqoyjqxktwkcqok') },
    'DEMOS_STAGING_DATABASE_TARGET_REJECTED');
});

test('scope, staging identity, explicit confirmation and production-safe routing are mandatory', () => {
  for (const mutation of [
    { DEMOS_DEPLOYMENT_SCOPE:undefined },
    { DEMOS_DEPLOYMENT_SCOPE:'staging' },
    { DEMOS_STAGING_PROJECT_ID:'wxnblcqoyjqxktwkcqok' },
    { DEMOS_STAGING_PROJECT_ID:undefined },
    { DEMOS_STAGING_CONFIRMATION:undefined },
    { NODE_ENV:'staging' },
    { NODE_ENV:'development' }
  ]) rejected(mutation,'DEMOS_STAGING_SCOPE_REJECTED');
});

test('shared Supabase pooler never routes to production or any other user or host', () => {
  for (const connection of [
    'postgresql://postgres.wxnblcqoyjqxktwkcqok:pass@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    'postgresql://postgres:pass@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    'postgresql://demos_staging_runtime:pass@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    'postgresql://'+STAGING_USERNAME+':pass@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
    'postgresql://'+STAGING_USERNAME+':pass@aws-1-eu-central-1.pooler.supabase.com:5433/postgres',
    'postgresql://'+STAGING_USERNAME+':pass@aws-1-eu-central-1.pooler.supabase.com:5432/demos',
    'postgresql://'+STAGING_USERNAME+':pass@db.wxnblcqoyjqxktwkcqok.supabase.co:5432/postgres',
    'postgresql://'+STAGING_USERNAME+':pass@127.0.0.1:5432/postgres',
    'postgresql://'+STAGING_USERNAME+':pass@aws-1-eu-central-1.pooler.supabase.com:5432/postgres#override',
    'postgresql://'+STAGING_USERNAME+'@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    'postgresql://'+STAGING_USERNAME+':pass@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?options=-csearch_path%3Dpublic',
    'postgresql://'+STAGING_USERNAME+':pass@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=disable',
    'postgresql://'+STAGING_USERNAME+':pass@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?pgbouncer=true&pgbouncer=true',
    'not-a-database-url'
  ]) rejected({ DATABASE_URL:connection }, 'DEMOS_STAGING_DATABASE_TARGET_REJECTED');
});

test('valid transaction pooler cannot override project selection via URL settings', () => {
  const env=baseEnv();
  env.DATABASE_URL=env.DATABASE_URL.replace(':5432/',':6543/')+'&pgbouncer=true';
  assert.equal(assertIsolatedStagingEnvironment(env).connectionKind,'supabase-pooler');
});

test('all unknown provider, token, credential or job env keys fail closed', () => {
  for (const name of [
    'FIREBASE_PRIVATE_KEY','FIREBASE_PROJECT_ID','FCM_SERVER_KEY',
    'AXIOM_API_TOKEN','B2_S3_SECRET_ACCESS_KEY','AWS_ACCESS_KEY_ID',
    'REDIS_URL','UPSTASH_REDIS_REST_TOKEN','SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY','DB_HOST','DB_PASSWORD','STAGING_DATABASE_URL',
    'JWT_SECRET','GOOGLE_APPLICATION_CREDENTIALS','ENABLE_CIVIC_PROCESS_SYNC',
    'AXIOM_ARCHIVE_ENABLED','DEMOS_STAGING_MIGRATION_MODE',
    'RENDER_DATABASE_URL','NODE_OPTIONS','LOG_LEVEL'
  ]) rejected({[name]: 'true'}, 'DEMOS_STAGING_PROVIDER_ENV_REJECTED');
});

test('monitoring, pool limits and production-only API surface are mandatory', () => {
  for (const change of [
    { PERFORMANCE_MONITOR_ENABLED:undefined },
    { PERFORMANCE_MONITOR_ENABLED:'true' },
    { DATABASE_POOL_MAX:undefined },
    { DATABASE_POOL_MAX:'100' },
    { DATABASE_POOL_MAX:'0' },
    { DATABASE_POOL_MAX:'3.5' },
    { DATABASE_POOL_MIN:'1' },
    { ALLOW_DEV_API_SURFACE:'true' }
  ]) rejected(change,'DEMOS_STAGING_SIDE_EFFECTS_REJECTED');
});

test('a failed preflight never loads server, app, DB or any external provider', () => {
  let boots=0;
  const launch=()=>{boots++;};
  assert.throws(
    ()=>startIsolatedStaging({env:{...baseEnv(),DATABASE_URL:'postgres://x:y@prod.invalid/postgres'},launch}),
    err=>err?.code==='DEMOS_STAGING_DATABASE_TARGET_REJECTED'
  );
  assert.equal(boots,0);
  assert.deepEqual(startIsolatedStaging({env:baseEnv(),launch}),{
    scope:'isolated-staging',projectId:STAGING_PROJECT_ID,
    connectionKind:'supabase-pooler',poolMax:2
  });
  assert.equal(boots,1);
});

test('actual staging entrypoint exits before importing server on a bad DB target', () => {
  const env={...baseEnv(),DATABASE_URL:'postgresql://u:fake@prod.invalid/postgres'};
  const result=spawnSync(process.execPath,['staging/isolatedStagingServer.js'],{
    cwd:path.resolve(__dirname,'..'),env,encoding:'utf8',timeout:5000
  });
  assert.equal(result.status,1);
  assert.match(result.stderr,/DEMOS_STAGING_BOOT_REJECTED/);
  assert.doesNotMatch(result.stderr,/prod\.invalid|synthetic-password|fake@/);
});

test('full app rejects isolated mode before any Express routes or DB modules', () => {
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const fence=app.indexOf("assertIsolatedStagingEnvironment(process.env)");
  const refuse=app.indexOf("throw error;");
  const express=app.indexOf("const express = require('express')");
  assert.ok(fence>0 && refuse>fence && express>refuse,
    'full backend must fail before routes/pools/providers in isolated staging');
  assert.match(app,/DEMOS_STAGING_FULL_APP_NOT_AUTHORIZED/);
  const server=fs.readFileSync(path.join(__dirname,'..','staging','isolatedStagingServer.js'),'utf8');
  assert.doesNotMatch(server,/require\(['"]\.\.\/(?:app|server)['"]\)/,
    'readiness-only entrypoint must not import the normal server');
});

test('invalid or missing listen port is denied before serving HTTP', () => {
  for (const PORT of [undefined,'','0','-1','100000','not-a-port','00080']) {
    rejected({PORT}, 'DEMOS_STAGING_SIDE_EFFECTS_REJECTED');
  }
});

test('readiness-only endpoint exposes no real application or sensitive data', async (t) => {
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
  assert.equal(health.headers.get('content-type'),'application/json; charset=utf-8');
  const json=await health.json();
  assert.deepEqual(json,{
    status:'preflight-only',
    gdprReady:false,
    databaseConnected:false,
    externalProvidersConnected:false
  });
  for (const route of [
    '/api/health','/api/auth/login','/api/sondaggi','/api/avvistamenti',
    '/api/admin/database','/api/user/delete-account',
    '/__staging/health?debug=true'
  ]) {
    const response=await fetch(base+route);
    assert.equal(response.status,404,route);
    assert.equal(response.headers.get('cache-control'),'no-store',route);
    assert.deepEqual(await response.json(),{error:'not_found'},route);
  }
  const mutation=await fetch(base+'/__staging/health',{method:'POST'});
  assert.equal(mutation.status,404);
  assert.deepEqual(await mutation.json(),{error:'not_found'});
});
