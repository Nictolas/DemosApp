const test = require('node:test');
const assert = require('node:assert/strict');
const { SNAPSHOT_TTL_MS, createResearchPoliticalSnapshotWriter } = require('../services/researchPoliticalSnapshotWriter');

test('political snapshot writer commits insert+expiry cleanup atomically with 24h TTL', async () => {
  const calls=[]; const fixed=new Date('2026-10-02T20:00:00.000Z');
  const client={query:async(sql,params)=>{calls.push({sql,params});return {rows:[]};},release:()=>calls.push({sql:'RELEASE'})};
  const writer=createResearchPoliticalSnapshotWriter({pool:{connect:async()=>client},now:()=>fixed});
  const out=await writer.replace({sourceSnapshotId:'snapshot-1',methodologyVersion:'v1',rows:[{candidateId:'c1',kind:'candidate',grade:'E',displayName:'Ada',opinions:{q1:2}}]});
  assert.equal(out.expiresAt.getTime()-out.generatedAt.getTime(),SNAPSHOT_TTL_MS);
  assert.equal(calls[0].sql,'BEGIN');
  assert.match(calls[1].sql,/DELETE FROM research_public_political_vectors/);
  assert.match(calls[1].sql,/IS NOT DISTINCT FROM/);
  assert.deepEqual(calls[1].params,['candidate','E',null,null,null,null]);
  assert.match(calls[2].sql,/INSERT INTO research_public_political_vectors/);
  assert.match(calls[3].sql,/DELETE FROM research_public_political_vectors WHERE expires_at <= \$1/);
  assert.equal(calls[4].sql,'COMMIT');
  assert.equal(calls[5].sql,'RELEASE');
});

test('political snapshot writer rolls back and never commits partial snapshot', async () => {
  const calls=[];let inserts=0;const client={query:async(sql)=>{calls.push(sql);if(/INSERT/.test(sql)&&++inserts===1)throw new Error('fail');},release:()=>calls.push('RELEASE')};
  const writer=createResearchPoliticalSnapshotWriter({pool:{connect:async()=>client}});
  await assert.rejects(()=>writer.replace({sourceSnapshotId:'snapshot-2',methodologyVersion:'v1',rows:[{candidateId:'c1',kind:'candidate',grade:'E',displayName:'Ada',opinions:{q1:2}}]}));
  assert.equal(calls.includes('ROLLBACK'),true);
  assert.equal(calls.includes('COMMIT'),false);
});

test('political snapshot writer rejects identity-shaped or oversized/unbounded rows', async () => {
  const writer=createResearchPoliticalSnapshotWriter({pool:{connect:async()=>{throw new Error('must not connect');}}});
  await assert.rejects(()=>writer.replace({sourceSnapshotId:'snapshot-3',methodologyVersion:'v1',rows:[]}));
  await assert.rejects(()=>writer.replace({sourceSnapshotId:'snapshot-3',methodologyVersion:'v1',rows:[{candidateId:'c1',kind:'candidate',grade:'E',displayName:'Ada',opinions:null}]}));
});


test('political snapshot writer rejects mixed scopes before opening a transaction', async () => {
  const writer=createResearchPoliticalSnapshotWriter({pool:{connect:async()=>{throw new Error('must not connect');}}});
  await assert.rejects(()=>writer.replace({sourceSnapshotId:'snapshot-mixed',methodologyVersion:'v1',rows:[
    {candidateId:'c1',kind:'candidate',grade:'E',region:'Toscana',displayName:'Ada',opinions:{q1:2}},
    {candidateId:'c2',kind:'candidate',grade:'E',region:'Lazio',displayName:'Bea',opinions:{q1:1}}
  ]}),/share one political scope/);
});
