'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processAndSaveVotazioni,
  runVotiParlamentoSyncCycle,
  votiParlamentoSyncJob
}=require('../jobs/votiParlamentoSyncJob');
const key='DEMOS_PRIVACY_RECOVERY_MAINTENANCE';
async function withMode(mode,fn) {
 const previous=process.env[key];
 try {
  if(mode===undefined)delete process.env[key];else process.env[key]=mode;
  return await fn();
 } finally {
  if(previous===undefined)delete process.env[key];else process.env[key]=previous;
 }
}
const vote=uri=>({votazione:{value:uri},label:{value:'Synthetic vote'},
 sedutaData:{value:'20261027'},approvato:{value:'1'}});
const votes=[vote('synthetic:vs19/1'),vote('synthetic:vs19/2')];
test('independent PostgreSQL writer does no SQL while recovery maintenance is active',async()=>{
 for(const mode of ['true','TRUE','false ','','0']){
  await withMode(mode,async()=>{
    let calls=0;
    const count=await processAndSaveVotazioni(votes,'Camera',{
      async query(){calls++;throw Error('Unexpected SQL');}
    });
    assert.equal(count,0);
    assert.equal(calls,0);
  });
 }
});
test('toggle recovery during first INSERT: second INSERT must never occur',async()=>{
 await withMode('false',async()=>{
  let writes=0;
  const count=await processAndSaveVotazioni(votes,'Camera',{
    async query(sql){
      writes++;
      assert.equal(writes,1,'second write escaped recovery');
      assert.match(sql,/INSERT INTO parlamento/);
      process.env[key]='true';
      return {rowCount:1};
    }
  });
  assert.equal(count,1,'one in-flight write can commit despite late flag');
  assert.equal(writes,1);
 });
});
test('normal cycle persists multiple rows and remains useful with flag false',async()=>{
 await withMode('false',async()=>{
  let writes=0;
  const count=await processAndSaveVotazioni(votes,'Camera',{
    async query(sql){writes++;assert.match(sql,/ON CONFLICT \(uri\)/);return {rowCount:1};}
  });
  assert.equal(count,2);
  assert.equal(writes,2);
 });
});
test('cycle must not fetch or write under active recovery, even with cron already scheduled',async()=>{
 for(const mode of ['true','TRUE','']){
  await withMode(mode,async()=>{
    let fetches=0,saves=0;
    const result=await runVotiParlamentoSyncCycle({
      async fetch(){fetches++;return votes;},
      async save(){saves++;return 2;}
    });
    assert.deepEqual(result,{blocked:true,saved:0});
    assert.equal(fetches,0);assert.equal(saves,0);
  });
 }
 assert.ok(votiParlamentoSyncJob);
});
test('toggle during remote fetch suppresses all subsequent saves and Senato fetch',async()=>{
 await withMode('false',async()=>{
  let fetches=0,saves=0;
  const result=await runVotiParlamentoSyncCycle({
    async fetch(){fetches++;process.env[key]='true';return votes;},
    async save(){saves++;return 2;}
  });
  assert.deepEqual(result,{blocked:true,saved:0});
  assert.equal(fetches,1);assert.equal(saves,0);
 });
});
test('toggle during first save never fetches Senato nor reports normal success',async()=>{
 await withMode('false',async()=>{
  let fetches=0,saves=0;
  const result=await runVotiParlamentoSyncCycle({
    async fetch(){fetches++;return votes;},
    async save(){saves++;process.env[key]='true';return 1;}
  });
  assert.deepEqual(result,{blocked:true,saved:1});
  assert.equal(fetches,1);assert.equal(saves,1);
 });
});
test('normal cycle fetches both houses when recovery disabled',async()=>{
 await withMode('false',async()=>{
  const fetched=[],saved=[];
  const result=await runVotiParlamentoSyncCycle({
    async fetch(camera){fetched.push(camera);return votes;},
    async save(rows,camera){saved.push(camera);return rows.length;}
  });
  assert.deepEqual(result,{blocked:false,saved:4});
  assert.deepEqual(fetched,['Camera','Senato']);
  assert.deepEqual(saved,['Camera','Senato']);
 });
});
