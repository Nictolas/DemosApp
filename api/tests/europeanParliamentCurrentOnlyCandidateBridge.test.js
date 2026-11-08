'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  officialMepEvidenceMatches,candidateFromVerifiedBallot,
  prepareVettedEuropeanCurrentVoteCandidates
}=require('../services/europeanParliamentCurrentOnlyCandidateBridge');
const UUID1='37e6d079-d075-4ea0-8ab4-16a172f3dedb';
const UUID2='48f7e180-e186-4fb1-8bc5-27b283f4edec';
const dt='2026-10-22';
const official='https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-'+dt+'/decisions';
const ballot=id=>({
  verified:true,mepId:id,date:dt,officialOrder:45,
  voteId:'MTG-PL-'+dt+'-DEC-199517',
  subject:'Votazione sul testo nel suo insieme',
  vote:'Favorevole',outcome:'Approvato',sourceUrl:official
});
const coverage=()=>{
  const current=new Map();
  for(let n=0;n<76;n++)current.set(String(256900+n),ballot(String(256900+n)));
  return {incomplete:false,current,checkedSittings:['2026-10-22','2026-10-21'],
    covered:76,totalItalianMepIds:76,latestSitting:'2026-10-22'};
};
const link=(id,uuid)=>({
  institution:'PE',representative_id:uuid,source_person_id:id,
  evidence_url:'https://data.europarl.europa.eu/person/'+id,
  verified_at:'2026-11-08T00:00:00.000Z'
});

test('official MEP evidence must embed exactly that MepId on institutional host',()=>{
  assert.ok(officialMepEvidenceMatches('https://data.europarl.europa.eu/person/256900','256900'));
  assert.ok(officialMepEvidenceMatches('https://www.europarl.europa.eu/meps/en/256900/QA/home','256900'));
  for(const url of [
    'https://data.europarl.europa.eu/person/2569000',
    'https://data.europarl.europa.eu/person/25690',
    'https://www.europarl.europa.eu/',
    'https://www.europarl.europa.eu/meps/en/2569000/QA/home',
    'http://data.europarl.europa.eu/person/256900',
    'https://data.europarl.europa.eu@fake.invalid/person/256900',
    'https://data.europarl.europa.eu/person/256900?ignore=1',
    'https://data.europarl.europa.eu/person/256900#x',
    'https://evil.invalid/person/256900'
  ]) assert.equal(officialMepEvidenceMatches(url,'256900'),false,url);
});

test('no identities: zero current candidates, never publish name-matched or guessed votes',()=>{
  const out=prepareVettedEuropeanCurrentVoteCandidates(coverage(),[]);
  assert.equal(out.vettedLinks,0);assert.equal(out.prepared,0);
  assert.equal(out.withoutCertifiedIdentity,76);assert.deepEqual(out.candidates,[]);
  assert.equal(out.writesPerformed,0);
});

test('one unique vetted identity creates one latest-current candidate with canonical DEMOS key',()=>{
  const out=prepareVettedEuropeanCurrentVoteCandidates(coverage(),[link('256900',UUID1)]);
  assert.equal(out.prepared,1);assert.equal(out.withoutCertifiedIdentity,75);
  assert.deepEqual(out.candidates[0],{
    institution:'PE',representativeKey:'demos:'+UUID1,
    sourcePersonId:'256900',ballotId:'MTG-PL-2026-10-22-DEC-199517',
    voteDate:dt,ballotOrder:45,status:'Favorevole',
    ballotTitle:'Votazione sul testo nel suo insieme',ballotOutcome:'Approvato',
    sourceUrl:official,sourceType:'pe_ufficiale',verified:true
  });
  assert.equal('nome' in out.candidates[0],false);
  assert.equal('gruppo_politico' in out.candidates[0],false);
  assert.equal('voti_storici' in out.candidates[0],false);
  assert.ok(Object.isFrozen(out.candidates));
});

test('ambiguous UUID, MepId or evidence rejects entire preview instead of duplicate writes',()=>{
  const good=link('256900',UUID1);
  const variants=[
    [good,{...link('256901',UUID2),representative_id:UUID1}],
    [good,{...link('256900',UUID2)}],
    [good,{...link('256901',UUID2),evidence_url:'https://data.europarl.europa.eu/person/256900'}],
    [good,{...link('256901',UUID2),institution:'Senato'}],
    [good,{...link('256901',UUID2),verified_at:null}]
  ];
  for(const xs of variants)
    assert.throws(()=>prepareVettedEuropeanCurrentVoteCandidates(coverage(),xs),/EP_CURRENT_/);
});

test('missing official roll-call, wrong decision, unknown member or partial coverage always fails',()=>{
  const c=coverage();
  c.incomplete=true;
  assert.throws(()=>prepareVettedEuropeanCurrentVoteCandidates(c,[link('256900',UUID1)]),/FULL_SOURCE_COVERAGE/);
  const unknown=link('777777',UUID1);
  assert.throws(()=>prepareVettedEuropeanCurrentVoteCandidates(coverage(),[unknown]),/ID_NOT_IN_LIVE_ROSTER/);
  const invalid=coverage();invalid.current.set('256900',{...ballot('256900'),verified:false});
  assert.throws(()=>prepareVettedEuropeanCurrentVoteCandidates(invalid,[link('256900',UUID1)]),/VERIFIED_BALLOT/);
  const badDate=coverage();badDate.current.set('256900',{...ballot('256900'),date:'2026-10-21'});
  assert.throws(()=>prepareVettedEuropeanCurrentVoteCandidates(badDate,[link('256900',UUID1)]),/VERIFIED_BALLOT/);
  const noOutcome=coverage();noOutcome.current.set('256900',{...ballot('256900'),outcome:null});
  assert.throws(()=>prepareVettedEuropeanCurrentVoteCandidates(noOutcome,[link('256900',UUID1)]),/VERIFIED_BALLOT/);
});

test('no database APIs, network writers or party fields in candidate bridge',()=>{
  const exports=require('../services/europeanParliamentCurrentOnlyCandidateBridge');
  assert.deepEqual(Object.keys(exports).sort(),[
    'candidateFromVerifiedBallot','officialMepEvidenceMatches',
    'prepareVettedEuropeanCurrentVoteCandidates'
  ]);
  const p=candidateFromVerifiedBallot('256900',UUID1,ballot('256900'));
  assert.equal(p.representativeKey,'demos:'+UUID1);
  assert.equal(p.verified,true);
});
