'use strict';
// NO NETWORK. Exercises fail-closed exporter invocation checks with a wrapped
// SDK client and synthetic data; never contacts Backblaze, SQL or real services.
const test=require('node:test');
const assert=require('node:assert/strict');
const {S3Client}=require('@aws-sdk/client-s3');
const {PrivacyErasureB2Journal}=require('../services/privacyErasureB2Journal');
const env={
  GDPR_LEDGER_B2_ENABLED:'true',
  GDPR_LEDGER_B2_BUCKET:'synthetic-gdpr-wrap-gate',
  GDPR_LEDGER_B2_REGION:'eu-central-003',
  GDPR_LEDGER_B2_ENDPOINT:'https://s3.eu-central-003.backblazeb2.com',
  GDPR_LEDGER_B2_ACCESS_KEY_ID:'synthetic-only',
  GDPR_LEDGER_B2_SECRET_ACCESS_KEY:'synthetic-only',
  GDPR_LEDGER_B2_RETENTION_DAYS:'30',
  B2_BUCKET_NAME:'different-synthetic-log-bucket'
};
const event={
  event_key:'00000000-0000-4000-8000-000000000801',
  subject_user_id:'00000000-0000-4000-8000-000000000802',
  event_type:'account_deleted',
  occurred_at:'2026-10-30T10:00:00.000Z',
  details:{fixture:true}
};
const refused='GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED';
const config=client=>new PrivacyErasureB2Journal({env,client});
async function asProcess(argv,action) {
  const original=process.argv[1];
  try {
    process.argv[1]=argv;
    return await action();
  } finally { process.argv[1]=original; }
}
async function asGithubActions(value,action) {
  const prior=process.env.GITHUB_ACTIONS;
  try {
    if(value===undefined)delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS=value;
    return await action();
  } finally {
    if(prior===undefined)delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS=prior;
  }
}
function fake(){
  let sends=0;
  const client={send(){sends++;throw Error('NETWORK_MUST_NOT_BE_CALLED');}};
  return {client,calls:()=>sends};
}

test('wrapped SDK client cannot bypass the direct-write NO-GO under an app entrypoint',async()=>{
  const sdk=new S3Client({region:'eu-central-003',
    credentials:{accessKeyId:'not-real',secretAccessKey:'not-real'}});
  let sends=0;
  sdk.send=()=>{sends++;throw Error('NETWORK_MUST_NOT_BE_CALLED');};
  const wrapped={send:(...args)=>sdk.send(...args)};
  try {
    await asProcess('/srv/demos/api/server.js',async()=>{
      await assert.rejects(config(wrapped).archiveEvent(event),{message:refused});
      let sql=0;
      await assert.rejects(config(wrapped).archiveBatch({
        query(){sql++;throw Error('SQL_MUST_NOT_BE_CALLED');}
      }),{message:refused});
      assert.equal(sql,0);
    });
    assert.equal(sends,0);
  } finally {sdk.destroy();}
});

test('a generic injected adapter also fails closed during normal server launch',async()=>{
  const f=fake();
  await asProcess('/srv/demos/api/index.js',async()=>{
    const exporter=config(f.client);
    await assert.rejects(exporter.archiveEvent(event),{message:refused});
    assert.equal(exporter.writeInProgress,undefined);
    assert.equal(exporter.uncertainWrite,false);
  });
  assert.equal(f.calls(),0);
});

test('GITHUB_ACTIONS alone is insufficient for an arbitrary CLI/script path',async()=>{
  const f=fake();
  await asGithubActions('true',async()=>{
    for(const executable of [
      '/srv/demos/api/scripts/export-gdpr.js',
      '/srv/demos/api/services/privacyErasureB2Journal.js',
      '/srv/demos/api/tests/not-a-test.js',
      '/srv/demos/api/tests/../../../server.test.js'
    ]) {
      await asProcess(executable,async()=>{
        await assert.rejects(config(f.client).archiveEvent(event),{message:refused});
      });
    }
  });
  assert.equal(f.calls(),0);
});

test('a test-shaped script without GitHub Actions isolation is also denied',async()=>{
  const f=fake();
  await asProcess('/work/DemosApp/api/tests/synthetic.test.js',async()=>{
    for(const value of [undefined,'false','TRUE','1']) {
      await asGithubActions(value,async()=>{
        await assert.rejects(config(f.client).archiveEvent(event),{message:refused});
      });
    }
  });
  assert.equal(f.calls(),0);
});

test('rejected runtime invocation never creates an SDK, queries SQL or changes latches',async()=>{
  await asProcess('/opt/app/api/server.js',async()=>{
    const exporter=new PrivacyErasureB2Journal({env});
    await assert.rejects(exporter.archiveEvent(event),{message:refused});
    await assert.rejects(exporter.archiveBatch({
      query(){throw Error('UNEXPECTED_SQL');}
    }),{message:refused});
    assert.equal(exporter.client,null);
    assert.equal(exporter.writeInProgress,undefined);
    assert.equal(exporter.uncertainWrite,false);
  });
});
