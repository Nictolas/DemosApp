'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {refreshSelectedEuropeanCurrentVote}=require('../services/europeanParliamentSelectedCurrentVoteRefresh');
const day='2026-10-22';
const reviewer='00000000-0000-4000-8000-000000000101';
const people=['00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000104'];
const links=['234567','234568'].map((id,i)=>({
  institution:'PE',representative_id:people[i],source_person_id:id,
  evidence_url:'https://data.europarl.europa.eu/person/'+id,
  review_state:'VERIFIED',reviewed_by:reviewer,
  reviewed_at:'2026-11-08T20:00:00Z',verified_at:'2026-11-08T20:00:00Z'
}));
const covered=(ids)=>({selectedOnly:true,incomplete:false,covered:ids.length,
  totalItalianMepIds:ids.length,latestSitting:ids.length?day:null,
  checkedSittings:ids.length?[day]:[],current:new Map(ids.map((id,i)=>[id,{
    verified:true,mepId:id,date:day,officialOrder:20+i,
    voteId:'MTG-PL-'+day+'-DEC-'+(123456+i),
    subject:'Synthetic final whole-text decision',vote:'Favorevole',outcome:'Approvato',
    sourceUrl:'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+day+'/decisions'
  }]))});
async function enabled(fn){
  const old=process.env.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED;
  process.env.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED='true';
  try{return await fn();}
  finally{if(old===undefined)delete process.env.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED;
    else process.env.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED=old;}
}
function fakePool(rows){
  const calls=[],state={selects:0,connects:0,releases:0};
  return {query:async sql=>{state.selects++;assert.match(sql,/SELECT l.institution/);return {rows}},
    connect:async()=>{state.connects++;return {query:async sql=>{calls.push(sql);return {rows:[]}},
      release:()=>{state.releases++}};},
    calls,state};
}
test('default OFF never even touches PostgreSQL or upstream',async()=>{
  const old=process.env.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED;
  delete process.env.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED;
  try{
    assert.deepEqual(await refreshSelectedEuropeanCurrentVote({
      query:async()=>{throw Error('NO_DB')},connect:async()=>{throw Error('NO_DB')}
    },{previewOptions:{fetchVotes:async()=>{throw Error('NO_HTTP')}},
      upsertVote:async()=>{throw Error('NO_WRITE')}}),
    {enabled:false,prepared:0,changed:0,skipped:0});
  }finally{if(old!==undefined)process.env.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED=old;}
});
test('zero VERIFIED selected links: one SQL SELECT, zero HTTP and zero DML',()=>enabled(async()=>{
  const pool=fakePool([]);let network=0;
  const result=await refreshSelectedEuropeanCurrentVote(pool,{
    previewOptions:{client:{get:async()=>{network++;throw Error('NO_HTTP')}}},
    upsertVote:async()=>{throw Error('NO_WRITE')}
  });
  assert.deepEqual(result,{enabled:true,prepared:0,changed:0,skipped:0});
  assert.equal(network,0);assert.equal(pool.state.selects,1);
  assert.equal(pool.state.connects,0);
}));
test('two reviewed MEPs use one transaction and canonical DEMOS UUID keys',()=>enabled(async()=>{
  const pool=fakePool(links),writes=[];let fetches=0;
  const result=await refreshSelectedEuropeanCurrentVote(pool,{
    previewOptions:{fetchVotes:async({targetMepIds})=>{
      fetches++;return covered(targetMepIds);
    }},
    upsertVote:async(_,candidate)=>{
      writes.push(candidate);
      assert.equal(candidate.institution,'PE');
      assert.equal(candidate.sourceType,'pe_ufficiale');
      return {changed:writes.length===1};
    }
  });
  assert.deepEqual(result,{enabled:true,prepared:2,changed:1,skipped:1});
  assert.equal(fetches,1);
  assert.deepEqual(writes.map(v=>v.representativeKey),people.map(id=>'demos:'+id));
  assert.ok(writes.every(v=>!('history' in v)&&!('gruppo_politico' in v)));
  assert.deepEqual(pool.calls,['BEGIN','COMMIT']);
  assert.equal(pool.state.releases,1);
}));
test('writer failure causes ROLLBACK of entire batch',()=>enabled(async()=>{
  const pool=fakePool(links);let count=0;
  await assert.rejects(refreshSelectedEuropeanCurrentVote(pool,{
    previewOptions:{fetchVotes:async({targetMepIds})=>covered(targetMepIds)},
    upsertVote:async()=>{count++;if(count===2)throw Error('REVIEW_REVOKED');
      return {changed:true};}
  }),/REVIEW_REVOKED/);
  assert.deepEqual(pool.calls,['BEGIN','ROLLBACK']);
  assert.equal(pool.state.releases,1);
}));
test('incomplete source coverage fails before opening a transaction',()=>enabled(async()=>{
  const pool=fakePool(links.slice(0,1));
  await assert.rejects(refreshSelectedEuropeanCurrentVote(pool,{
    previewOptions:{fetchVotes:async()=>({...covered(['234567']),incomplete:true})},
    upsertVote:async()=>{throw Error('NO_WRITE')}
  }),/EP_CURRENT_FULL_SOURCE_COVERAGE_REQUIRED/);
  assert.equal(pool.state.connects,0);
}));
test('unrecognized writer result is a rollback, never a success',()=>enabled(async()=>{
  const pool=fakePool(links.slice(0,1));
  await assert.rejects(refreshSelectedEuropeanCurrentVote(pool,{
    previewOptions:{fetchVotes:async()=>covered(['234567'])},
    upsertVote:async()=>({changed:'yes'})
  }),/EP_CURRENT_PERSIST_WRITER_RESULT_INVALID/);
  assert.deepEqual(pool.calls,['BEGIN','ROLLBACK']);
}));
