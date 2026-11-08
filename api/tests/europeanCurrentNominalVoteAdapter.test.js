'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  stableMepId, extractExplicitItalianVotes, persistExplicitItalianEuropeanVotes
} = require('../services/europeanCurrentNominalVoteAdapter');

const vetted = (id, representativeId) => ({id,representativeId,
  review_state:'VERIFIED',reviewed_by:'00000000-0000-4000-8000-000000000099',
  reviewed_at:'2026-11-08T19:00:00Z',
  evidence_url:'https://data.europarl.europa.eu/person/'+id});
const official = new Map([
  ['https://data.europarl.europa.eu/person/12345', vetted('12345','00000000-0000-4000-8000-000000000005')],
  ['https://data.europarl.europa.eu/person/12346', vetted('12346','00000000-0000-4000-8000-000000000006')]
]);
const meta = {
  ballotId:'MTG-PL-2026-11-08-ITM-222',
  voteDate:'2026-11-08',
  ballotOrder:222,
  ballotTitle:'Verified official roll-call fixture',
  sourceUrl:'https://data.europarl.europa.eu/api/v2/vote-results/MTG-PL-2026-11-08-ITM-222',
  sourceType:'pe_ufficiale',verified:true
};

test('official MEP IDs match exactly (not by name or substring)', () => {
  assert.equal(stableMepId('12345'),'12345');
  assert.equal(stableMepId('https://data.europarl.europa.eu/person/12345'),'12345');
  assert.equal(stableMepId('https://data.europarl.europa.eu/person/123450'),'123450');
  assert.equal(stableMepId('https://evil.example/person/12345'),null);
  assert.equal(stableMepId('Test Person'),null);
  assert.equal(stableMepId('http://data.europarl.europa.eu/person/12345?spoofed=true'),null);
});

test('explicit status only: missing list member is not inferred absent', () => {
  const votes=extractExplicitItalianVotes({
    votedFor:['https://data.europarl.europa.eu/person/12345', '99999'],
    votedAgainst:[],
    votedAbstained:[]
  },official,meta);
  assert.equal(votes.length,1);
  assert.equal(votes[0].representativeKey,'demos:00000000-0000-4000-8000-000000000005');
  assert.equal(votes[0].status,'Favorevole');
  assert.equal(votes[0].sourcePersonId,'12345');
  assert.ok(votes.every(v => !('gruppo_politico' in v) && v.status!=='Assente'));
});

test('ambiguous or unverified European results never touch the database', async () => {
  const invalid=[
    [{votedFor:['12345'],votedAgainst:['12345']},meta],
    [{votedFor:['12345'],votedAgainst:[]},{...meta,verified:false}],
    [{votedFor:['12345'],votedAgainst:[]},{...meta,sourceType:'openpolis'}],
    [{votedFor:['name-only']},meta],
    [{},meta],
    [{votedFor:'12345'},meta],
    [{votedFor:['12345']},{...meta,ballotOrder:null}]
  ];
  for(const [result,m] of invalid){
    let writes=0;
    await assert.rejects(
      persistExplicitItalianEuropeanVotes({connect:async()=>{writes++;throw Error('should not connect')}},
        result,official,m),
      /EP_CURRENT_/
    );
    assert.equal(writes,0);
  }
});

test('EP adapter commits atomically and preserves official IDs', async () => {
  const statements=[];
  const client={query:async(sql,values)=>{
    statements.push({sql,values});
    return {rows:sql.includes('INSERT INTO public.institutional_current_nominal_votes')?[{ballot_id:meta.ballotId}]:[]};
  },release:()=>statements.push({sql:'RELEASE'})};
  const result=await persistExplicitItalianEuropeanVotes(
    {connect:async()=>client},
    {votedFor:['12345'],votedAgainst:['12346']},official,meta);
  assert.deepEqual(result,{considered:2,changed:2});
  assert.equal(statements[0].sql,'BEGIN');
  assert.equal(statements.at(-2).sql,'COMMIT');
  assert.equal(statements[1].values[1],'demos:00000000-0000-4000-8000-000000000005');
  assert.equal(statements[2].values[1],'demos:00000000-0000-4000-8000-000000000006');
  assert.ok(statements.every(row=> !row.values || !row.values.includes('Political group')));
});

test('unreviewed/UUID-less EP identities fail before a DB connection', async () => {
  for (const link of [
    {id:'12345'},
    {...vetted('12345','00000000-0000-4000-8000-000000000005'),review_state:'PENDING'},
    {...vetted('12345','00000000-0000-4000-8000-000000000005'),evidence_url:'https://evil.test/person/12345'}
  ]) {
    let connections=0;
    await assert.rejects(
      persistExplicitItalianEuropeanVotes({connect:async()=>{connections++;throw Error('UNEXPECTED_DB')}},
        {votedFor:['12345']},new Map([['12345',link]]),meta),
      /EP_CURRENT_VERIFIED_DEMOS_LINK_REQUIRED/
    );
    assert.equal(connections,0);
  }
});
