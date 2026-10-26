'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const job=require('../jobs/referendumForecastSnapshotJob');
const {captureReferendumForecastSnapshots}=require('../services/referendumForecastSnapshotService');
const flag='DEMOS_PRIVACY_RECOVERY_MAINTENANCE';
const now=new Date('2026-10-27T00:00:00.000Z');
async function withFlag(value,fn) {
  const old=process.env[flag];
  try {
    if(value===undefined)delete process.env[flag];else process.env[flag]=value;
    return await fn();
  } finally {
    if(old===undefined)delete process.env[flag];else process.env[flag]=old;
  }
}
const row=id=>({civic_ballot_id:id,opens_at:'2026-12-01T00:00:00.000Z',
 total_responses:10,yes_count:7,no_count:3,abstain_count:0});
test('child job start and execution reject all active or malformed recovery flags',async()=>{
 for(const value of ['true','TRUE','false ','','0']){
  await withFlag(value,async()=>{
    const before=job.lastRunAt;
    assert.equal(await job.execute(),undefined);
    assert.equal(job.lastRunAt,before);
    job.start();
    assert.equal(job.interval,null);
  });
 }
});
test('no snapshot SQL during maintenance',async()=>{
 for(const value of ['true','TRUE','false ','']){
  await withFlag(value,async()=>{
   let queries=0;
   const result=await captureReferendumForecastSnapshots({
     now,pool:{async query(){queries++;throw Error('Unexpected SQL');}}
   });
   assert.equal(queries,0);
   assert.equal(result.maintenanceBlocked,true);
  });
 }
});
test('maintenance turned on during SELECT prevents every INSERT',async()=>{
 await withFlag('false',async()=>{
   let reads=0;
   const result=await captureReferendumForecastSnapshots({now,pool:{
     async query(){reads++;if(reads!==1)throw Error('Unexpected INSERT');
      process.env[flag]='true';return {rows:[row('00000000-0000-4000-8000-000000000001')]};}
   }});
   assert.equal(reads,1);assert.equal(result.maintenanceBlocked,true);
   assert.equal(result.captured,0);
 });
});
test('maintenance during first INSERT prevents next INSERT, not the in-flight SQL',async()=>{
 await withFlag('false',async()=>{
  let n=0;
  const result=await captureReferendumForecastSnapshots({now,pool:{
    async query(sql){n++;if(n===1)return {rows:[
      row('00000000-0000-4000-8000-000000000001'),
      row('00000000-0000-4000-8000-000000000002')]};
     if(n!==2)throw Error('Second INSERT must not run');
     assert.match(sql,/INSERT INTO civic_ballot_forecast_snapshots/);
     process.env[flag]='true';
     return {rowCount:1};
    }
  }});
  assert.equal(n,2);assert.equal(result.maintenanceBlocked,true);
  assert.equal(result.captured,1);
 });
});
test('normal snapshot flow remains operational when maintenance is false',async()=>{
 await withFlag('false',async()=>{
  let n=0;
  const result=await captureReferendumForecastSnapshots({now,pool:{
   async query(){n++;return n===1?{rows:[
     row('00000000-0000-4000-8000-000000000001')]}:{rowCount:1};}
  }});
  assert.equal(n,2);assert.equal(result.captured,1);
  assert.equal(result.schemaReady,true);assert.equal(result.maintenanceBlocked,undefined);
 });
});
