'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {
  prepareVettedEuropeanCurrentVoteCandidates
}=require('../services/europeanParliamentCurrentOnlyCandidateBridge');

const upstreamPath=process.env.EP_CURRENT_WRITER_PATH;
const writer=upstreamPath?require(path.resolve(upstreamPath)):null;
const mep='256900';
const uuid='37e6d079-d075-4ea0-8ab4-16a172f3dedb';
const date='2026-10-22';
const approved={
  institution:'PE',representative_id:uuid,source_person_id:mep,
  evidence_url:'https://data.europarl.europa.eu/person/'+mep,
  verified_at:'2026-11-08T19:00:00.000Z',
  review_state:'VERIFIED',reviewed_by:'00000000-0000-4000-8000-000000000099',
  reviewed_at:'2026-11-08T19:00:00.000Z'
};
const ballot={
  verified:true,mepId:mep,
  date,officialOrder:44,voteId:'MTG-PL-'+date+'-DEC-199517',
  subject:'Testo complessivo, ultimo voto verificato',
  vote:'Favorevole',outcome:'Approvato',
  sourceUrl:'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+date+'/decisions'
};
const coverage={
  selectedOnly:true,latestSitting:date,checkedSittings:[date],
  covered:1,totalItalianMepIds:1,incomplete:false,
  current:new Map([[mep,ballot]])
};
function prepared() {
  const result=prepareVettedEuropeanCurrentVoteCandidates(coverage,[approved]);
  assert.equal(result.prepared,1);
  assert.equal(result.writesPerformed,0);
  assert.equal(result.candidates[0].representativeKey,'demos:'+uuid);
  return result.candidates[0];
}

test('shared current-vote writer MUST accept approved EP candidate from PR #635',{
  skip:!writer
},()=>{
  const v=writer.assertVerifiedVote(prepared());
  assert.equal(v.institution,'PE');
  assert.equal(v.representativeKey,'demos:'+uuid);
  assert.equal(v.sourcePersonId,mep);
  assert.equal(v.sourceType,'pe_ufficiale');
  assert.equal(v.verified,true);
});
test('shared current-only writer receives just one canonical insert and never stores history',{
  skip:!writer
},async()=>{
  const candidate=prepared();
  const statements=[];
  const db={query:async(sql,params)=>{
    statements.push({sql,params});
    return {rows:[{institution:'PE',representative_key:'demos:'+uuid,
      ballot_id:candidate.ballotId,vote_date:date,vote:'Favorevole'}]};
  }};
  const result=await writer.upsertVerifiedCurrentVote(db,candidate);
  assert.equal(result.changed,true);
  assert.equal(statements.length,1);
  assert.match(statements[0].sql,/ON CONFLICT \(representative_key\) DO UPDATE/);
  assert.match(statements[0].sql,/vote_date < EXCLUDED.vote_date/);
  assert.equal(statements[0].params[1],'demos:'+uuid);
  assert.equal(statements[0].params[2],mep);
  assert.doesNotMatch(statements[0].sql,/\bparlamento_voti_nominali\b/i);
});
test('source person cannot be substituted by a different numeric MepId in the official preview',{
  skip:!writer
},()=>{
  assert.throws(()=>prepareVettedEuropeanCurrentVoteCandidates(coverage,[
    {...approved,source_person_id:'256901',
      evidence_url:'https://data.europarl.europa.eu/person/256901'}
  ]),/EP_CURRENT_ID_NOT_IN_LIVE_ROSTER/);
  assert.throws(()=>writer.assertVerifiedVote({...prepared(),sourcePersonId:'person/256900'}),
    /CURRENT_VOTE_SOURCE_PERSON_INVALID/);
});

test('shared PR #633 writer MUST reject unlinked pe:<MepId> before any query',{
  skip:!writer
},async()=>{
  const unlinked={...prepared(),representativeKey:'pe:'+mep};
  assert.throws(()=>writer.assertVerifiedVote(unlinked),/CURRENT_VOTE_STABLE_ID_REQUIRED/);
  let queried=false;
  await assert.rejects(writer.upsertVerifiedCurrentVote({
    query:async()=>{queried=true;throw Error('SHOULD_NOT_QUERY')}
  },unlinked),/CURRENT_VOTE_STABLE_ID_REQUIRED/);
  assert.equal(queried,false);
});
