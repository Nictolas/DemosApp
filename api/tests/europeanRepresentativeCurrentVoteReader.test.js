'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {projectVerifiedEuropeanCurrentVote,readVerifiedEuropeanCurrentVote}=
  require('../services/europeanRepresentativeCurrentVoteReader');
const {decisionUrl}=require('../services/europeanParliamentOfficialDecisionReader');
const DAY='2026-10-22', UUID='37e6d079-d075-4ea0-8ab4-16a172f3dedb';
const row={
  source_person_id:'256900',ballot_id:'MTG-PL-2026-10-22-DEC-199517',
  vote_date:DAY,ballot_order:35,vote:'Favorevole',
  source_url:decisionUrl(DAY),source_type:'pe_ufficiale',
  identity_evidence_url:'https://data.europarl.europa.eu/person/256900',
  gruppo_politico:'NEVER_EXPOSE'
};
const candidate={
  voteId:row.ballot_id,date:DAY,officialOrder:35,verified:true,final:true,
  subject:'Risoluzione sul testo nel suo insieme',
  outcome:'Approvato',sourceUrl:decisionUrl(DAY),
  ballots:new Map([['256900','Favorevole'],['256901','Contrario']])
};

test('one verified current EU vote shown with the official adopted outcome, without politics/history',()=>{
  const got=projectVerifiedEuropeanCurrentVote(row,[candidate]);
  assert.deepEqual(got,{
    verified:true,mepId:'256900',voteId:row.ballot_id,
    subject:'Risoluzione sul testo nel suo insieme',date:DAY,
    vote:'Favorevole',outcome:'Approvato',sourceUrl:decisionUrl(DAY)
  });
  assert.ok(!JSON.stringify(got).includes('NEVER_EXPOSE'));
});
test('rejects unverified or wrong official position, order, outcome, URL and date',()=>{
  const changes=[
    [{...row,source_url:'https://attacker.invalid'},[candidate]],
    [{...row,source_person_id:'2569000'},[candidate]],
    [{...row,source_person_id:'Some Person'},[candidate]],
    [{...row,vote:'Assente'},[candidate]],
    [{...row,ballot_order:34},[candidate]],
    [{...row,vote_date:'2026-10-21'},[candidate]],
    [row,[{...candidate,final:false}]],
    [row,[{...candidate,verified:false}]],
    [row,[{...candidate,outcome:null}]],
    [row,[{...candidate,ballots:new Map()}]],
    [row,[candidate,candidate]]
  ];
  for(const [record,official] of changes)
    assert.equal(projectVerifiedEuropeanCurrentVote(record,official),null);
});
test('only stable DEMOS UUID is read from the shared current-vote table, never by name',async()=>{
  let called=0, fetched=0;
  const db={query:async(sql,params)=>{
    called++;assert.match(sql,/SELECT c\.source_person_id/);
    assert.match(sql,/INNER JOIN public\.institutional_nominal_identity_links AS x/);
    assert.match(sql,/x\.source_person_id = c\.source_person_id/);
    assert.match(sql,/x\.representative_id = \$1::uuid/);
    assert.match(sql,/x\.review_state = 'VERIFIED'/);
    assert.match(sql,/x\.reviewed_by IS NOT NULL AND x\.reviewed_at IS NOT NULL/);
    assert.match(sql,/x\.evidence_url LIKE 'https:\/\/data\.europarl\.europa\.eu\/%'/);
    assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE|DROP|JOIN\s+users/i);
    assert.deepEqual(params,[UUID,'demos:'+UUID]);
    return {rows:[row]};
  }};
  const got=await readVerifiedEuropeanCurrentVote(db,UUID,{
    fetchDecisions:async date=>{fetched++;assert.equal(date,DAY);return [candidate];}
  });
  assert.equal(called,1);assert.equal(fetched,1);assert.equal(got?.mepId,'256900');
});
test('migration absent, no rows, invalid UUID or official outage: fail closed',async()=>{
  const missing={query:async()=>{const error=new Error('missing table');error.code='42P01';throw error;}};
  assert.equal(await readVerifiedEuropeanCurrentVote(missing,UUID),null);
  const empty={query:async()=>({rows:[]})};
  assert.equal(await readVerifiedEuropeanCurrentVote(empty,UUID),null);
  let calls=0;
  const invalid={query:async()=>{calls++;throw Error('SHOULD NOT QUERY')}};
  assert.equal(await readVerifiedEuropeanCurrentVote(invalid,'John Smith'),null);
  assert.equal(calls,0);
  const db={query:async()=>({rows:[row]})};
  assert.equal(await readVerifiedEuropeanCurrentVote(db,UUID,{
    fetchDecisions:async()=>{throw new Error('EP_RATE_LIMIT')}
  }),null);
});

test('unvetted EU identity link rejects current row before external API call',async()=>{
  let requests=0;
  const db={query:async(sql)=>{requests++;assert.match(sql,/institutional_nominal_identity_links/);return {rows:[]};}};
  assert.equal(await readVerifiedEuropeanCurrentVote(db,UUID,{
    fetchDecisions:async()=>{throw Error('external API must not be called without identity link');}
  }),null);
  assert.equal(requests,1);
});


test('official EU homepage or different profile ID is NOT proof of this person’s identity',async()=>{
  const wrong=['https://www.europarl.europa.eu/',
    'https://data.europarl.europa.eu/person/2569000',
    'https://www.europarl.europa.eu/meps/en/256901/OTHER/home',
    'https://data.europarl.europa.eu/person/256900?spoof=1',
    null];
  for(const evidence of wrong){
    let network=0;
    const db={query:async()=>({rows:[{
      ...row,identity_evidence_url:evidence
    }]})};
    const got=await readVerifiedEuropeanCurrentVote(db,UUID,{
      fetchDecisions:async()=>{network++;return [candidate];}
    });
    assert.equal(got,null);
    assert.equal(network,0,'No outbound API after a failed source-ID identity proof');
  }
});
