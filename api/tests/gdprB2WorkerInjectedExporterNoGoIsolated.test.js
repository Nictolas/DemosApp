'use strict';
// TEST ONLY. Exercises the DRAFT worker with a synthetic injected exporter.
// No provider, real database, credentials, PII, production or network calls.
const test=require('node:test');
const assert=require('node:assert/strict');
const {S3Client}=require('@aws-sdk/client-s3');
const {PrivacyErasureOutboxWorker}=
  require('../services/privacyErasureOutboxWorker');
const {PrivacyErasureB2Journal}=require('../services/privacyErasureB2Journal');
const URL='postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const flags={
  GDPR_ERASURE_OUTBOX_ENABLED:'true',
  GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true',
  GDPR_LEDGER_B2_ENABLED:'true',
  DEMOS_PRIVACY_RECOVERY_MAINTENANCE:'false'
};
const error='GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED';
const forbiddenPool={connect(){throw Error('UNEXPECTED_SQL');}};
const fake=()=>{
  let configCalls=0,archiveCalls=0;
  return {client:{
    config(){configCalls++;return {synthetic:true};},
    archiveEvent(){archiveCalls++;throw Error('UNEXPECTED_PROVIDER');}
  },counts:()=>({configCalls,archiveCalls})};
};
async function asEnv(patch,fn) {
  const keys=Object.keys(patch),before=Object.fromEntries(
    keys.map(k=>[k,process.env[k]]));
  try {
    for(const k of keys) {
      if(patch[k]===undefined)delete process.env[k];
      else process.env[k]=patch[k];
    }
    return await fn();
  } finally {
    for(const k of keys) {
      if(before[k]===undefined)delete process.env[k];
      else process.env[k]=before[k];
    }
  }
}
async function asProcess(filename,fn) {
  const original=process.argv[1];
  try {process.argv[1]=filename;return await fn();}
  finally {process.argv[1]=original;}
}
const denied=async (f,workerEnv=flags)=>{
  const worker=new PrivacyErasureOutboxWorker({env:workerEnv,exporter:f.client});
  await assert.rejects(worker.runOnce(forbiddenPool),{message:error});
  assert.deepEqual(f.counts(),{configCalls:0,archiveCalls:0});
};

test('wrapped real AWS client injected as custom exporter is rejected in server',async()=>{
  const sdk=new S3Client({
    region:'eu-central-003',
    credentials:{accessKeyId:'synthetic-only',secretAccessKey:'synthetic-only'}
  });
  let sends=0,configured=0;
  sdk.send=()=>{sends++;throw Error('UNEXPECTED_NETWORK');};
  const wrapped={
    config(){configured++;return {synthetic:false};},
    archiveEvent:async row=>sdk.send({row})
  };
  try {
    const worker=new PrivacyErasureOutboxWorker({env:flags,exporter:wrapped});
    await asProcess('/srv/demos/api/server.js',async()=>{
      await assert.rejects(worker.runOnce(forbiddenPool),{message:error});
    });
    assert.equal(configured,0);assert.equal(sends,0);
  } finally {sdk.destroy();}
});

test('custom exporter blocked during normal application start, even if enabled',async()=>{
  await asProcess('/app/api/index.js',async()=>denied(fake()));
});

test('CI flags alone do not allow custom exporters from scripts or service entrypoints',async()=>{
  for(const filename of ['/app/api/scripts/gdpr.js',
    '/app/api/services/privacyErasureOutboxWorker.js',
    '/app/api/tests/not-synthetic.js']) {
    await asProcess(filename,async()=>denied(fake()));
  }
});

test('test-file path alone cannot turn a local/non-CI run into a worker',async()=>{
  await asProcess('/repo/api/tests/isolated.test.js',async()=>{
    for(const value of [undefined,'false','TRUE']) {
      await asEnv({GITHUB_ACTIONS:value},async()=>denied(fake()));
    }
  });
});

test('invalid CI marker, DB target or production env denies before fake config',async()=>{
  for(const patch of [
    {GDPR_OUTBOX_WORKER_CI:'not-isolated'},
    {TEST_DATABASE_URL:'postgresql://postgres@remote.example/production'},
    {DATABASE_URL:'postgresql://synthetic@remote/db'},
    {SUPABASE_URL:'https://example.supabase.co'},
    {SUPABASE_DB_URL:'postgres://synthetic@remote'},
    {SUPABASE_SERVICE_ROLE_KEY:'placeholder'},
    {RENDER:'true'},
    {RENDER_SERVICE_ID:'fake-service'}
  ]) {
    await asEnv(patch,async()=>denied(fake()));
  }
});

test('real PrivacyErasureB2Journal is blocked even inside isolated CI',async()=>{
  const wrapped=new PrivacyErasureB2Journal({
    env:flags,client:{send(){throw Error('UNEXPECTED_PROVIDER');}}
  });
  const worker=new PrivacyErasureOutboxWorker({env:flags,exporter:wrapped});
  await assert.rejects(worker.runOnce(forbiddenPool),{message:error});
});

test('isolated CI retains synthetic fake exporter validation without SQL',()=>{
  const f=fake();
  const worker=new PrivacyErasureOutboxWorker({env:flags,exporter:f.client});
  assert.doesNotThrow(()=>worker.validate());
  assert.deepEqual(f.counts(),{configCalls:1,archiveCalls:0});
});

test('maintenance and disabled worker switches deny even inside isolated CI',async()=>{
  for(const updated of [
    {...flags,DEMOS_PRIVACY_RECOVERY_MAINTENANCE:'true'},
    {...flags,GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'false'}
  ]) {
    const f=fake();
    const worker=new PrivacyErasureOutboxWorker({env:updated,exporter:f.client});
    await assert.rejects(worker.runOnce(forbiddenPool),
      /recovery maintenance|worker is disabled/);
    assert.deepEqual(f.counts(),{configCalls:0,archiveCalls:0});
  }
});

test('only the exact disposable backend-pool role and URL remain eligible in isolated CI',async()=>{
  const local='postgresql://gdpr_runtime_ci_worker:synthetic-ci-only@127.0.0.1:5432/' +
    'gdpr_runtime_pool_ci?sslmode=require&pgbouncer=true';
  await asEnv({GDPR_BACKEND_POOL_CI:'isolated',DATABASE_URL:local},async()=>{
    const f=fake();
    const worker=new PrivacyErasureOutboxWorker({env:flags,exporter:f.client});
    assert.doesNotThrow(()=>worker.validate());
    assert.deepEqual(f.counts(),{configCalls:1,archiveCalls:0});
  });
  for(const invalid of [
    local.replace('gdpr_runtime_ci_worker','postgres'),
    local.replace('127.0.0.1','localhost'),
    local.replace('gdpr_runtime_pool_ci','production'),
    local.replace('pgbouncer=true','pgbouncer=false')
  ]) {
    await asEnv({GDPR_BACKEND_POOL_CI:'isolated',DATABASE_URL:invalid},
      async()=>denied(fake()));
  }
  await asEnv({GDPR_BACKEND_POOL_CI:undefined,DATABASE_URL:local},
    async()=>denied(fake()));
});
