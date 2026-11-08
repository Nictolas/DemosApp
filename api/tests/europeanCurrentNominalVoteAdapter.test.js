'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  stableMepId, extractExplicitItalianVotes, persistExplicitItalianEuropeanVotes
} = require('../services/europeanCurrentNominalVoteAdapter');

const official = new Map([
  ['https://data.europarl.europa.eu/person/12345', { id:'12345', nome_completo:'Fixture One' }],
  ['https://data.europarl.europa.eu/person/12346', { id:'12346', nome_completo:'Fixture Two' }]
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
  assert.equal(votes[0].representativeKey,'pe:12345');
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
    return {rows:sql.startsWith('INSERT INTO')?[{ballot_id:meta.ballotId}]:[]};
  },release:()=>statements.push({sql:'RELEASE'})};
  const result=await persistExplicitItalianEuropeanVotes(
    {connect:async()=>client},
    {votedFor:['12345'],votedAgainst:['12346']},official,meta);
  assert.deepEqual(result,{considered:2,changed:2});
  assert.equal(statements[0].sql,'BEGIN');
  assert.equal(statements.at(-2).sql,'COMMIT');
  assert.equal(statements[1].values[1],'pe:12345');
  assert.equal(statements[2].values[1],'pe:12346');
  assert.ok(statements.every(row=> !row.values || !row.values.includes('Political group')));
});
