'use strict';
// Synthetic guard only. Never open a real database or B2 connection.
const test=require('node:test');
const assert=require('node:assert/strict');
const {PrivacyErasureOutboxWorker}=require('../services/privacyErasureOutboxWorker');
const {PrivacyErasureB2Journal}=require('../services/privacyErasureB2Journal');

const env={
  GDPR_ERASURE_OUTBOX_ENABLED:'true',
  GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true',
  GDPR_LEDGER_B2_ENABLED:'true',
  DEMOS_PRIVACY_RECOVERY_MAINTENANCE:'false'
};
const forbiddenPool={
  connect(){throw Error('UNEXPECTED_SQL_CONNECTION');}
};

test('default Draft worker refuses real B2 exporter before touching SQL or network',async()=>{
  const worker=new PrivacyErasureOutboxWorker({env});
  assert.ok(worker.exporter instanceof PrivacyErasureB2Journal);
  await assert.rejects(worker.runOnce(forbiddenPool),{
    message:'GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED'
  });
});

test('even explicitly injected real B2 exporter cannot bypass the guard',async()=>{
  const exporter=new PrivacyErasureB2Journal({env,client:{
    send(){throw Error('UNEXPECTED_B2_NETWORK');}
  }});
  const worker=new PrivacyErasureOutboxWorker({env,exporter});
  await assert.rejects(worker.runOnce(forbiddenPool),{
    message:'GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED'
  });
});

test('maintenance and disabled feature flags remain stricter than the new guard',async()=>{
  const maintenance=new PrivacyErasureOutboxWorker({
    env:{...env,DEMOS_PRIVACY_RECOVERY_MAINTENANCE:'true'}
  });
  await assert.rejects(maintenance.runOnce(forbiddenPool),/recovery maintenance/);
  const disabled=new PrivacyErasureOutboxWorker({
    env:{...env,GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'false'}
  });
  await assert.rejects(disabled.runOnce(forbiddenPool),/disabled/);
});

test('injected fake exporter still permits isolated CI validate without provider IO',()=>{
  let configured=0;
  const worker=new PrivacyErasureOutboxWorker({
    env,exporter:{config(){configured++;return {synthetic:true};}}
  });
  assert.doesNotThrow(()=>worker.validate());
  assert.equal(configured,1);
});
