'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createHybridExternalRestoreGate}=
  require('../experiments/opinionAnswersV2ExternalRestoreGateCandidate');
const {createHybridHttpResearchRouter}=
  require('../experiments/opinionAnswersV2HttpContractCandidate');
const {createHybridAuthorizedReadCandidate}=
  require('../experiments/opinionAnswersV2AuthorizedReadCandidate');
const {createHybridRegionalHttpResearchRouter}=
  require('../experiments/opinionAnswersV2RegionalHttpCandidate');

const generation='00000000-0000-4000-8000-000000000081';
const otherGeneration='00000000-0000-4000-8000-000000000082';
const self='00000000-0000-4000-8000-000000000083';
const snapshotId='backup_2026_10_30_01';
const nowMs=Date.parse('2026-10-30T15:00:30Z');
function validAttestation(){
  return {
    restore_generation:generation,
    snapshot_id:snapshotId,
    restore_status:'ready',
    ledger_complete:true,
    replay_committed:true,
    ingress_restore_barrier:'externally_enforced',
    external_ledger_digest:'a'.repeat(64),
    snapshot_at:'2026-10-30T11:00:00Z',
    ledger_covers_from:'2026-10-30T10:59:00Z',
    ledger_covers_through:'2026-10-30T14:59:15Z',
    replay_scope_through:'2026-10-30T14:59:00Z',
    replay_completed_at:'2026-10-30T14:59:45Z',
    issued_at:'2026-10-30T15:00:00Z',
    expires_at:'2026-10-30T15:00:59Z'
  };
}
function create(override={}){
  let current=validAttestation();
  let verifier=true;
  let verificationCalls=0;
  const gate=createHybridExternalRestoreGate({
    getExternalAttestation:async()=>current,
    verifyExternalAttestation:async()=>{
      verificationCalls++;
      return verifier;
    },
    expectedRestoreGeneration:generation,
    expectedSnapshotId:snapshotId,
    now:()=>nowMs,...override
  });
  return {
    gate,
    update:value=>{current={...current,...value};},
    setVerifier:value=>{verifier=value;},
    verificationCalls:()=>verificationCalls
  };
}

test('external gate opens only for independently verified complete snapshot attestation',async()=>{
  const x=create();
  assert.equal(await x.gate(),true);
  assert.equal(x.verificationCalls(),1);
  assert.throws(()=>createHybridExternalRestoreGate({
    getExternalAttestation:async()=>validAttestation(),
    expectedRestoreGeneration:generation,
    expectedSnapshotId:snapshotId
  }),/External restore verifier/);
  assert.throws(()=>createHybridExternalRestoreGate({
    getExternalAttestation:async()=>validAttestation(),
    verifyExternalAttestation:async()=>true,
    expectedRestoreGeneration:'bad',
    expectedSnapshotId:snapshotId
  }),/pinned restore identity/);
});

test('cannot reuse old readiness after a new restore generation or snapshot ID',async()=>{
  const x=create();
  x.update({restore_generation:otherGeneration});
  await assert.rejects(x.gate(),e=>e.code==='RESTORE_NOT_READY');
  assert.equal(x.verificationCalls(),0);
  x.update({restore_generation:generation,snapshot_id:'wrong_backup'});
  await assert.rejects(x.gate(),e=>e.code==='RESTORE_NOT_READY');
});

test('cannot open during partial replay, missing external barrier or unverified ledger',async()=>{
  for(const variation of [
    {restore_status:'restoring'},
    {ledger_complete:false},
    {replay_committed:false},
    {ingress_restore_barrier:'none'},
    {external_ledger_digest:''},
    {external_ledger_digest:'invalid'}
  ]){
    const x=create();
    x.update(variation);
    await assert.rejects(x.gate(),e=>e.code==='RESTORE_NOT_READY');
    assert.equal(x.verificationCalls(),0);
  }
});

test('ledger coverage must include the backup boundary and complete replay scope',async()=>{
  const cases=[
    {ledger_covers_from:'2026-10-30T12:00:00Z'},
    {ledger_covers_through:'2026-10-30T14:58:59Z'},
    {replay_completed_at:'2026-10-30T14:58:59Z'},
    {snapshot_at:'2026-10-30T15:00:00Z'},
    {issued_at:'2026-10-30T14:59:00Z'},
    {ledger_covers_through:'invalid-timestamp'}
  ];
  for(const variation of cases){
    const x=create();x.update(variation);
    await assert.rejects(x.gate(),e=>e.code==='RESTORE_NOT_READY');
  }
});

test('a stale, overlong, future-dated or expired lease cannot be used as a permanent pass',async()=>{
  for(const variation of [
    {issued_at:'2026-10-30T14:58:00Z',expires_at:'2026-10-30T15:01:00Z'},
    {expires_at:'2026-10-30T15:00:20Z'},
    {issued_at:'2026-10-30T15:00:40Z',expires_at:'2026-10-30T15:01:10Z'},
    {issued_at:'2026-10-30T14:59:00Z',expires_at:'2026-10-30T15:00:59Z'}
  ]){
    const x=create();x.update(variation);
    await assert.rejects(x.gate(),e=>e.code==='RESTORE_NOT_READY');
  }
});

test('an unauthenticated, unavailable or rejected external attestation fails closed',async()=>{
  const rejected=create();rejected.setVerifier(false);
  await assert.rejects(rejected.gate(),e=>e.code==='RESTORE_NOT_READY');
  const unavailable=create({
    getExternalAttestation:async()=>{throw Error('network unavailable')}
  });
  await assert.rejects(unavailable.gate(),e=>e.code==='RESTORE_NOT_READY');
  const invalidVerifier=create({
    verifyExternalAttestation:async()=>{throw Error('invalid signature')}
  });
  await assert.rejects(invalidVerifier.gate(),e=>e.code==='RESTORE_NOT_READY');
});

test('old Android GET and national/regional stats return 503 BEFORE personal SQL when external gate closes',async()=>{
  const x=create();
  let personalReads=0,publicAggregates=0;
  const catalog=[{id:'opinione_0',text:'Domanda di prova',gradi_opinione:['N']}];
  const deps={
    immutableLegacyIds:['opinione_0'],
    authenticate:async req=>req.headers.authorization==='Bearer synthetic'
      ? {userId:self}:null,
    resolveGrade:grade=>grade==='N'?'N':'',
    getGradeOpinions:grade=>grade==='N'?catalog:[],
    getPublishedOpinion:id=>catalog.find(op=>op.id===id)||null,
    assertRestoreReady:x.gate,
    loadOwnAuthorizedRow:createHybridAuthorizedReadCandidate({
      assertRestoreReady:x.gate,
      db:{query:async(_sql,[subject])=>{
        personalReads++;
        return {rows:[{
          subject_id:subject,granted:true,
          answer_row:{user_id:subject,opinione_0:'f',answers_extra:{}}
        }]};
      }}
    }),
    querySingleAggregate:async id=>{
      publicAggregates++;
      return [{opinion_id:id,favorevole:10,contrario:0,indeciso:0}];
    },
    queryDemographic:async()=>[],
    querySingleRegionalAggregate:async id=>{
      publicAggregates++;
      return [{opinion_id:id,favorevole:10,contrario:0,indeciso:0}];
    },
    queryRegionalDemographic:async()=>[]
  };
  const app=express();
  app.use('/api/opinioni',createHybridHttpResearchRouter(deps));
  app.use('/api/opinioni',createHybridRegionalHttpResearchRouter(deps));
  const server=await new Promise((resolve,reject)=>{
    const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);
  });
  const base='http://127.0.0.1:'+server.address().port;
  async function get(route,headers){
    const r=await fetch(base+route,{headers});
    return {status:r.status,body:await r.json()};
  }
  try{
    x.update({restore_status:'restoring'});
    const routes=[
      ['/api/opinioni/opinioni-list?grado=N',{authorization:'Bearer synthetic'}],
      ['/api/opinioni/stats/opinione_0',{}],
      ['/api/opinioni/stats/opinione_0/regione/toscana',{}],
      ['/api/opinioni/stats/opinione_0/genere/regione/toscana',{}]
    ];
    for(const [route,headers] of routes){
      const r=await get(route,headers);
      assert.equal(r.status,503);
      assert.equal(r.body.success,false);
      assert.equal(JSON.stringify(r.body).includes('userAnswer'),false);
    }
    assert.equal(personalReads,0);
    assert.equal(publicAggregates,0);
    x.update({restore_status:'ready'});
    const personal=await get(routes[0][0],routes[0][1]);
    assert.equal(personal.status,200);
    assert.equal(personalReads,1);
    const regional=await get(routes[2][0]);
    assert.equal(regional.status,200);
    assert.equal(publicAggregates,1);
    x.update({restore_generation:otherGeneration});
    const stale=await get(routes[0][0],routes[0][1]);
    assert.equal(stale.status,503);
    assert.equal(personalReads,1);
  }finally{
    await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  }
});
