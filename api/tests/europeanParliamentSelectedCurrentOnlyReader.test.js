'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  SELECT_VERIFIED_SELECTED_MEP_LINKS,
  fetchVerifiedSelectedEuropeanLinks,
  prepareSelectedEuropeanCurrentOnlyPreview
}=require('../services/europeanParliamentSelectedCurrentOnlyReader');
const A='37e6d079-d075-4ea0-8ab4-16a172f3dedb';
const B='48f7e180-e186-4fb1-8bc5-27b283f4edec';
const reviewed='00000000-0000-4000-8000-000000000099';
const DAY='2026-10-22';
function link(id,uuid){
  return {institution:'PE',representative_id:uuid,source_person_id:id,
    evidence_url:'https://data.europarl.europa.eu/person/'+id,
    review_state:'VERIFIED',reviewed_by:reviewed,
    reviewed_at:'2026-11-08T19:00:00Z',
    verified_at:'2026-11-08T19:00:00Z'};
}
function ballot(id){
  return {verified:true,mepId:id,date:DAY,officialOrder:22,
    voteId:'MTG-PL-'+DAY+'-DEC-199517',
    subject:'Final whole-text decision',vote:'Favorevole',outcome:'Approvato',
    sourceUrl:'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+DAY+'/decisions'};
}
function coverage(ids){
  const current=new Map(ids.map(id=>[id,ballot(id)]));
  return {selectedOnly:true,incomplete:false,covered:ids.length,
    totalItalianMepIds:ids.length,current,
    checkedSittings:ids.length?[DAY]:[],latestSitting:ids.length?DAY:null};
}
function fakeDb(rows) {
  let count=0;
  return {query:async sql=>{
    count++;assert.equal(sql,SELECT_VERIFIED_SELECTED_MEP_LINKS);
    return {rows};
  },count:()=>count};
}
test('target query is only a SELECT of human-verified actively followed MEP UUIDs',()=>{
  assert.match(SELECT_VERIFIED_SELECTED_MEP_LINKS,/^SELECT /);
  assert.match(SELECT_VERIFIED_SELECTED_MEP_LINKS,/l.review_state = 'VERIFIED'/);
  assert.match(SELECT_VERIFIED_SELECTED_MEP_LINKS,/l.reviewed_at IS NOT NULL/);
  assert.match(SELECT_VERIFIED_SELECTED_MEP_LINKS,/follower.status = 'a'/);
  assert.match(SELECT_VERIFIED_SELECTED_MEP_LINKS,/m.office_code = 'E' AND m.status = 'ACTIVE'/);
  assert.match(SELECT_VERIFIED_SELECTED_MEP_LINKS,/lower\(trim\(to_jsonb\(r\)->>'rappresentante_europeo'\)\) = l.representative_id::text/);
  assert.doesNotMatch(SELECT_VERIFIED_SELECTED_MEP_LINKS,/\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP)\b/i);
  assert.doesNotMatch(SELECT_VERIFIED_SELECTED_MEP_LINKS,/parlamento_europeo_voti_nominali|cognome|nome|gruppo_politico|partito/i);
  assert.match(SELECT_VERIFIED_SELECTED_MEP_LINKS,/LIMIT 101/);
});
test('zero approved followed MEPs -> zero HTTP, zero preview candidates and one SQL SELECT',async()=>{
  const db=fakeDb([]);
  let network=0;
  const preview=await prepareSelectedEuropeanCurrentOnlyPreview(db,{
    client:{get:async()=>{network++;throw Error('NEVER_FETCH_WITH_ZERO_FOLLOWERS');}}
  });
  assert.deepEqual(preview,{vettedLinks:0,prepared:0,
    withoutCertifiedIdentity:0,writesPerformed:0,candidates:[]});
  assert.equal(network,0);
  assert.equal(db.count(),1);
});
test('two vetted followed MEPs -> one current candidate per UUID, one source batch only',async()=>{
  const ids=['256900','256901'];
  const db=fakeDb([link(ids[0],A),link(ids[1],B)]);
  let reads=0,optionsSeen;
  const out=await prepareSelectedEuropeanCurrentOnlyPreview(db,{
    fetchVotes:async options=>{
      reads++;optionsSeen=options;
      return coverage(ids);
    },now:'2026-11-08T20:00:00Z',maxSittings:8
  });
  assert.equal(reads,1);assert.equal(db.count(),1);
  assert.deepEqual(optionsSeen.targetMepIds,ids);
  assert.equal(optionsSeen.maxSittings,8);
  assert.equal(out.vettedLinks,2);
  assert.equal(out.prepared,2);
  assert.equal(out.writesPerformed,0);
  assert.deepEqual(out.candidates.map(c=>c.representativeKey),['demos:'+A,'demos:'+B]);
  assert.deepEqual(out.candidates.map(c=>c.sourcePersonId),ids);
  assert.ok(Object.isFrozen(out.candidates));
  assert.equal('gruppo_politico' in out.candidates[0],false);
});
test('PENDING, wrong host, reviewer missing, different official ID or duplicate ID fail before API use',async()=>{
  const invalid=[
    {...link('256900',A),review_state:'PENDING',reviewed_by:null,reviewed_at:null},
    {...link('256900',A),evidence_url:'https://www.europarl.europa.eu/'},
    {...link('256900',A),evidence_url:'https://data.europarl.europa.eu/person/2569000'},
    {...link('256900',A),reviewed_by:null},
    {...link('256900',A),reviewed_at:null},
    {...link('256900',A),institution:'Camera'}
  ];
  for(const row of invalid) {
    let fetched=0;
    await assert.rejects(prepareSelectedEuropeanCurrentOnlyPreview(fakeDb([row]),{
      fetchVotes:async()=>{fetched++;throw Error('UNEXPECTED_NETWORK');}
    }),/EP_SELECTED_INSTITUTIONAL_IDENTITY_NOT_VERIFIED/);
    assert.equal(fetched,0);
  }
  for(const rows of [
    [link('256900',A),link('256900',B)],
    [link('256900',A),link('256901',A)]
  ])await assert.rejects(fetchVerifiedSelectedEuropeanLinks(fakeDb(rows)),
    /EP_SELECTED_DUPLICATE_INSTITUTIONAL_IDENTITY/);
});
test('unavailable DB or overly large response cannot trigger source fetch',async()=>{
  await assert.rejects(fetchVerifiedSelectedEuropeanLinks(null),/EP_SELECTED_READ_ONLY_DB_REQUIRED/);
  await assert.rejects(fetchVerifiedSelectedEuropeanLinks(fakeDb(Array.from({length:101},()=>link('256900',A)))),
    /EP_SELECTED_SOURCE_LINK_RESULTS_INVALID/);
  await assert.rejects(prepareSelectedEuropeanCurrentOnlyPreview(
    {query:async()=>{throw Error('DB_UNAVAILABLE');}},
    {fetchVotes:async()=>{throw Error('SHOULD_NOT_FETCH');}}
  ),/DB_UNAVAILABLE/);
});
test('official individual vote incomplete -> fail closed, no partial persistence',async()=>{
  const db=fakeDb([link('256900',A)]);
  await assert.rejects(prepareSelectedEuropeanCurrentOnlyPreview(db,{
    fetchVotes:async()=>({...coverage(['256900']),incomplete:true})
  }),/EP_CURRENT_FULL_SOURCE_COVERAGE_REQUIRED/);
});
