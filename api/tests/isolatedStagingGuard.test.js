'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertIsolatedStagingEnvironment, STAGING_PROJECT_ID } =
  require('../staging/isolatedStagingGuard');
const { startIsolatedStaging } = require('../staging/isolatedStagingServer');
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

test('app integrates the pre-import fence and does not schedule its passive jobs on staging', () => {
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const fence=app.indexOf("assertIsolatedStagingEnvironment(process.env)");
  const express=app.indexOf("const express = require('express')");
  assert.ok(fence>0 && express>fence,'staging guard must run before routes/pools/providers');
  assert.match(app,/if \(!isolatedStaging\) auditManager\.start\(\)/);
  assert.match(app,/const performanceMonitorEnabled = !isolatedStaging &&/);
  assert.match(app,/if \(!isolatedStaging\) performanceOptimizer\.start\(\)/);

  const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  assert.match(server,/if \(process\.env\.DEMOS_DEPLOYMENT_SCOPE !== 'isolated-staging'\) \{/);
  const firebaseInit=server.indexOf('initializeFirebaseAdmin()');
  const isolationGuard=server.indexOf("if (process.env.DEMOS_DEPLOYMENT_SCOPE !== 'isolated-staging')");
  assert.ok(isolationGuard>0 && firebaseInit>isolationGuard,
    'Firebase Admin initialization must stay in the non-staging block');
});
