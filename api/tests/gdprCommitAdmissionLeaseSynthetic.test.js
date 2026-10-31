'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {SyntheticIndependentAdmissionAuthority}=
  require('./fixtures/gdprIndependentAdmissionEpochSynthetic');
const {SyntheticCommitAdmissionLeaseGate}=
  require('./fixtures/gdprCommitAdmissionLeaseSynthetic');

const start=()=>{
  const authority=new SyntheticIndependentAdmissionAuthority();
  const ticket=authority.bootstrap({
    databaseId:'old-primary',checkpointHead:'a'.repeat(64)
  });
  const gate=new SyntheticCommitAdmissionLeaseGate(authority);
  const args={receipt:ticket,localDatabaseId:'old-primary',
    localEpoch:1,localOpen:true,operation:'write'};
  return {authority,ticket,gate,args};
};

test('negative control: a preflight-only SQL writer can commit after freeze',()=>{
  const {authority,ticket,args}=start();
  assert.equal(authority.assertAdmission(args).syntheticAdmission,true);
  authority.suspend(ticket);  // external gate now says blocked, epoch 2
  // An *uncontrolled* connection bypasses the external authority after
  // passing preflight. Synthetic write is intentional negative evidence.
  const sqlSnapshot={epoch:1,open:true,revision:0};
  if(sqlSnapshot.open && sqlSnapshot.epoch===args.localEpoch)
    sqlSnapshot.revision++;
  assert.equal(sqlSnapshot.revision,1,
    'old SQL backup still accepts an already-preflighted direct write');
  assert.throws(()=>authority.assertAdmission(args),
    {code:'GDPR_EPOCH_STALE_OR_FORGED'});
});

test('freeze closes new admissions immediately but waits for commit-finished lease',async()=>{
  const {gate,args}=start();
  const lease=gate.begin(args);
  let completed=false;
  const frozen=gate.freeze().then(v=>{completed=true;return v;});
  assert.equal(gate.state,'closing');
  assert.equal(gate.activeCount,1);
  assert.throws(()=>gate.begin(args),{code:'GDPR_LEASE_FREEZE_IN_PROGRESS'});
  await Promise.resolve();
  assert.equal(completed,false,'freeze cannot be acknowledged before DB finishes');
  // In the model this must occur AFTER real SQL COMMIT or ROLLBACK.
  gate.finish(lease);
  assert.deepEqual(await frozen,{
    syntheticFreezeAck:true,productionRecoveryReady:false
  });
  assert.equal(gate.activeCount,0);
  assert.equal(gate.state,'blocked');
  assert.throws(()=>gate.begin(args),{code:'GDPR_LEASE_FREEZE_IN_PROGRESS'});
});

test('different in-flight writers must both release before freeze acknowledges',async()=>{
  const {gate,args}=start();
  const first=gate.begin(args),second=gate.begin(args);
  let finished=false;
  const frozen=gate.freeze().then(v=>{finished=true;return v;});
  gate.finish(first);
  await Promise.resolve();
  assert.equal(finished,false);
  assert.equal(gate.activeCount,1);
  gate.finish(second);
  assert.equal((await frozen).syntheticFreezeAck,true);
  assert.equal(gate.state,'blocked');
});

test('fake or double-released leases cannot advance freeze barrier',async()=>{
  const {gate,args}=start();
  const a=gate.begin(args);
  const pending=gate.freeze();
  assert.throws(()=>gate.finish({synthetic:true}),
    {code:'GDPR_LEASE_UNKNOWN_OR_REUSED'});
  assert.equal(gate.activeCount,1);
  gate.finish(a);
  await pending;
  assert.throws(()=>gate.finish(a),{code:'GDPR_LEASE_UNKNOWN_OR_REUSED'});
  assert.equal(gate.activeCount,0);
  assert.deepEqual(await gate.freeze(),{
    syntheticFreezeAck:true,productionRecoveryReady:false
  });
});

test('authority outage and stale epochs both fail closed BEFORE a new lease',()=>{
  const {authority,ticket,gate,args}=start();
  authority.setAvailable(false);
  assert.throws(()=>gate.begin(args),{code:'GDPR_EPOCH_AUTHORITY_UNAVAILABLE'});
  assert.equal(gate.activeCount,0);
  authority.setAvailable(true);
  authority.suspend(ticket);
  assert.throws(()=>gate.begin(args),{code:'GDPR_EPOCH_STALE_OR_FORGED'});
  assert.equal(gate.activeCount,0);
});

test('crashed lease owner CANNOT be silently auto-approved for reopening',async()=>{
  const {gate,args}=start();
  gate.begin(args);
  let acknowledged=false;
  gate.freeze().then(()=>{acknowledged=true;});
  await Promise.resolve();
  assert.equal(gate.state,'closing');
  assert.equal(acknowledged,false);
  // No simulated owner returns, so no positive readiness signal is produced.
  // Real mitigation requires an independent enforced data-plane cutoff.
  assert.throws(()=>gate.begin(args),{code:'GDPR_LEASE_FREEZE_IN_PROGRESS'});
  assert.equal(gate.activeCount,1);
});

test('lease released before SQL COMMIT is a counterexample, not a release guarantee',async()=>{
  const {gate,args}=start();
  const lease=gate.begin(args);
  const sql={transactionOpen:true,commitDone:false};
  gate.finish(lease); // BUG in an actual integration; deliberately demonstrate
  await gate.freeze();
  assert.equal(gate.state,'blocked');
  assert.equal(sql.transactionOpen,true);
  assert.equal(sql.commitDone,false);
  // The fixture cannot introspect whether SQL truly committed. Production
  // must bind lease ownership through the actual SQL COMMIT/ROLLBACK boundary.
});

test('old database generation fails even if a new unrelated gate starts open',()=>{
  const {authority,ticket,args}=start();
  const blocked=authority.suspend(ticket);
  authority.admitRestoredGeneration({
    receipt:blocked,newDatabaseId:'restored-primary',
    newCheckpointHead:'b'.repeat(64),writersFenced:true,ingressBlocked:true,
    providersQuarantined:true,journalComplete:true,replayVerified:true
  });
  const newGate=new SyntheticCommitAdmissionLeaseGate(authority);
  assert.throws(()=>newGate.begin(args),{code:'GDPR_EPOCH_STALE_OR_FORGED'});
  assert.equal(newGate.activeCount,0);
});
