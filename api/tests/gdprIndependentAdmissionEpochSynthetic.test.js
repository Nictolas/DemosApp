'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {SyntheticIndependentAdmissionAuthority}=
  require('./fixtures/gdprIndependentAdmissionEpochSynthetic');

const oldHead='a'.repeat(64), newHead='b'.repeat(64);
const start=()=>{
  const authority=new SyntheticIndependentAdmissionAuthority();
  const ticket=authority.bootstrap({databaseId:'original-primary',checkpointHead:oldHead});
  return {authority,ticket};
};
const check=(authority,receipt,overrides={})=>authority.assertAdmission({
  receipt,localDatabaseId:'original-primary',localEpoch:1,
  localOpen:true,operation:'read',...overrides
});
const evidence=(receipt,extra={})=>({
  receipt,newDatabaseId:'recovered-primary',newCheckpointHead:newHead,
  writersFenced:true,ingressBlocked:true,providersQuarantined:true,
  journalComplete:true,replayVerified:true,...extra
});

test('current independently witnessed generation admits only synthetic read/write',()=>{
  const {authority,ticket}=start();
  for(const operation of ['read','write']){
    assert.deepEqual(check(authority,ticket,{operation}),{
      syntheticAdmission:true,productionRecoveryReady:false,epoch:1
    });
  }
});

test('lost/restored SQL snapshot with open gate remains BLOCKED after external suspend',()=>{
  const {authority,ticket}=start();
  const blocked=authority.suspend(ticket);
  assert.equal(blocked.epoch,2);
  assert.equal(blocked.phase,'blocked');
  // Simulate an old database backup with old gate OPEN and epoch=1.
  assert.throws(()=>check(authority,ticket),
    {code:'GDPR_EPOCH_STALE_OR_FORGED'});
  assert.throws(()=>check(authority,blocked),
    {code:'GDPR_EPOCH_ADMISSION_BLOCKED'});
  assert.throws(()=>check(authority,blocked,{localEpoch:2}),
    {code:'GDPR_EPOCH_ADMISSION_BLOCKED'});
});

test('stale signed receipt cannot be replayed after the independent epoch advances',()=>{
  const {authority,ticket}=start();
  const blocked=authority.suspend(ticket);
  const newTicket=authority.admitRestoredGeneration(evidence(blocked));
  assert.deepEqual([ticket.serial,blocked.serial,newTicket.serial],[1,2,3]);
  assert.deepEqual([ticket.epoch,blocked.epoch,newTicket.epoch],[1,2,3]);
  for(const stale of [ticket,blocked]){
    assert.throws(()=>check(authority,stale,{
      localDatabaseId:stale.databaseId,localEpoch:stale.epoch
    }),{code:'GDPR_EPOCH_STALE_OR_FORGED'});
  }
  assert.throws(()=>check(authority,newTicket),{
    code:'GDPR_EPOCH_ADMISSION_BLOCKED'
  });
  assert.deepEqual(check(authority,newTicket,{
    localDatabaseId:'recovered-primary',localEpoch:3,operation:'write'
  }),{syntheticAdmission:true,productionRecoveryReady:false,epoch:3});
});

test('recovery cannot reuse old database generation even with all mock flags',()=>{
  const {authority,ticket}=start();
  const blocked=authority.suspend(ticket);
  assert.throws(()=>authority.admitRestoredGeneration(evidence(blocked,{
    newDatabaseId:'original-primary'
  })),{code:'GDPR_EPOCH_RECOVERY_EVIDENCE_MISSING'});
  assert.equal(authority.current().phase,'blocked');
});

test('each missing independent recovery prerequisite keeps the barrier closed',()=>{
  for(const missing of [
    'writersFenced','ingressBlocked','providersQuarantined',
    'journalComplete','replayVerified'
  ]){
    const {authority,ticket}=start();
    const blocked=authority.suspend(ticket);
    assert.throws(()=>authority.admitRestoredGeneration(evidence(blocked,{
      [missing]:false
    })),{code:'GDPR_EPOCH_RECOVERY_EVIDENCE_MISSING'},missing);
    assert.equal(authority.current().phase,'blocked',missing);
  }
});

test('unknown or malformed external checkpoint cannot qualify recovered DB',()=>{
  const {authority,ticket}=start();
  const blocked=authority.suspend(ticket);
  assert.throws(()=>authority.admitRestoredGeneration(evidence(blocked,{
    newCheckpointHead:'not-a-sha256'
  })),{code:'GDPR_EPOCH_RECOVERY_EVIDENCE_MISSING'});
  assert.equal(authority.current().phase,'blocked');
});

test('forged, reordered, or edited ticket fields cannot bypass authority',()=>{
  const {authority,ticket}=start();
  const variations=[
    {...ticket,epoch:2},
    {...ticket,databaseId:'recovered-primary'},
    {...ticket,checkpointHead:newHead},
    {...ticket,serial:2},
    {...ticket,mac:'0'.repeat(64)},
    {...ticket,mac:'bad'},
    {...ticket,extra:'unsafe'}
  ];
  for(const edited of variations){
    assert.throws(()=>check(authority,edited),
      {code:'GDPR_EPOCH_STALE_OR_FORGED'});
  }
});

test('missing authority or missing receipt fails closed without offline fallback',()=>{
  const {authority,ticket}=start();
  authority.setAvailable(false);
  assert.throws(()=>check(authority,ticket),
    {code:'GDPR_EPOCH_AUTHORITY_UNAVAILABLE'});
  authority.setAvailable(true);
  assert.throws(()=>check(authority,null),
    {code:'GDPR_EPOCH_RECEIPT_MISSING'});
  assert.throws(()=>check(authority,{}),
    {code:'GDPR_EPOCH_STALE_OR_FORGED'});
});

test('local maintenance closed, wrong instance or wrong epoch are rejected',()=>{
  const {authority,ticket}=start();
  const candidates=[
    {localOpen:false},{localEpoch:0},{localEpoch:2},
    {localDatabaseId:'another-instance'},{localEpoch:'1'},
    {operation:'admin'}
  ];
  for(const candidate of candidates){
    const expected=candidate.operation==='admin'?
      'GDPR_EPOCH_INVALID_OPERATION':'GDPR_EPOCH_ADMISSION_BLOCKED';
    assert.throws(()=>check(authority,ticket,candidate),{code:expected});
  }
});

test('cannot bootstrap over an already independent witness or suspend twice',()=>{
  const {authority,ticket}=start();
  assert.throws(()=>authority.bootstrap({
    databaseId:'original-primary',checkpointHead:oldHead
  }),{code:'GDPR_EPOCH_BOOTSTRAP_DENIED'});
  const blocked=authority.suspend(ticket);
  assert.throws(()=>authority.suspend(blocked),
    {code:'GDPR_EPOCH_ALREADY_SUSPENDED'});
  assert.throws(()=>authority.admitRestoredGeneration(evidence(ticket)),
    {code:'GDPR_EPOCH_STALE_OR_FORGED'});
});

test('independent authority outage during recovery leaves old database rejected',()=>{
  const {authority,ticket}=start();
  const blocked=authority.suspend(ticket);
  authority.setAvailable(false);
  assert.throws(()=>authority.admitRestoredGeneration(evidence(blocked)),
    {code:'GDPR_EPOCH_AUTHORITY_UNAVAILABLE'});
  assert.throws(()=>check(authority,ticket),
    {code:'GDPR_EPOCH_AUTHORITY_UNAVAILABLE'});
  authority.setAvailable(true);
  assert.equal(authority.current().phase,'blocked');
});
