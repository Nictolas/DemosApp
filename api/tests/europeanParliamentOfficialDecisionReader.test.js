'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  decisionUrl,parseOfficialDecisionBallots,selectLatestFinalRollCall,joinOfficialAgendaSubjects,
  fetchOfficialDecisionBallots
} = require('../services/europeanParliamentOfficialDecisionReader');

const DAY='2026-10-22';
function rec(id='199569', overrides={}) {
  return {
    activity_id:'MTG-PL-'+DAY+'-DEC-'+id,
    activity_label:{en:'Final vote on public document '+id},
    headingLabel:{en:'Final vote'},
    decision_method:'def/ep-decision-methods/VOTE_ELECTRONIC_ROLLCALL',
    had_activity_type:'def/ep-activities/PLENARY_OUTCOME',
    decision_outcome:'def/ep-statuses/ADOPTED',
    had_voter_favor:['person/1234'],
    had_voter_against:['person/5678'],
    had_voter_abstention:['person/9012'],
    activity_order:99,
    ...overrides
  };
}
function body(...records){return {data:records};}

test('official API URL date constraints and authenticated unique MepId assignment',()=>{
  assert.match(decisionUrl(DAY), /data\.europarl\.europa\.eu\/api\/v2\/meetings\/MTG-PL-2026-10-22\/decisions/);
  assert.throws(()=>decisionUrl('2026-02-30'), /EP_INVALID_DATE/);
  const r=parseOfficialDecisionBallots(body(rec()),DAY);
  assert.equal(r.length,1);
  assert.equal(r[0].final,true);
  assert.equal(r[0].officialOrder,99);
  assert.equal(r[0].ballots.get('1234'),'Favorevole');
  assert.equal(r[0].ballots.get('5678'),'Contrario');
  assert.equal(r[0].ballots.get('9012'),'Astenuto');
  assert.equal(r[0].ballots.get('9999'),undefined);
  assert.equal(r[0].sourceUrl,decisionUrl(DAY));
  assert.equal(r[0].group,undefined);
  assert.equal(r[0].party,undefined);
});
test('amendments and uncertain finality never become displayed final ballots',()=>{
  const a=rec('199504',{activity_label:{en:'Amendment 5'},headingLabel:{en:'Paragraph 3'}});
  const list=parseOfficialDecisionBallots(body(a),DAY);
  assert.equal(list[0].final,false);
  assert.equal(selectLatestFinalRollCall([list],['person/1234']).size,0);
});
test('no fuzzy IDs, duplicate per-vote positions, invalid method or invalid outcome',()=>{
  const data=body(
    rec('1',{had_voter_against:['person/1234']}),
    rec('2',{decision_method:'def/ep-decision-methods/VOTE_SECRET'}),
    rec('3',{decision_outcome:'def/ep-statuses/WITHDRAWN'}),
    rec('4',{had_voter_favor:['person/12345']})
  );
  const r=parseOfficialDecisionBallots(data,DAY);
  assert.equal(r.length,1);
  assert.equal(r[0].voteId.endsWith('-4'),true);
  assert.equal(r[0].ballots.get('1234'),undefined);
  assert.equal(r[0].ballots.get('12345'),'Favorevole');
});
test('only a more recent comparable official order can become latest',()=>{
  const newer=rec('2',{activity_order:42,had_voter_favor:[],had_voter_against:['person/1234'],had_voter_abstention:[]});
  const older=rec('1',{activity_order:40,had_voter_favor:['person/1234'],had_voter_against:[],had_voter_abstention:[]});
  const r=selectLatestFinalRollCall([parseOfficialDecisionBallots(body(older,newer),DAY)],['person/1234']);
  assert.equal(r.get('1234').vote,'Contrario');
  assert.equal(r.get('1234').officialOrder,42);
});
test('unknown same-day official order fails closed rather than assuming vote IDs are chronological',()=>{
  const a=rec('1',{activity_order:null});
  const b=rec('2',{activity_order:null,had_voter_favor:[],had_voter_against:['person/1234']});
  const r=selectLatestFinalRollCall([parseOfficialDecisionBallots(body(a,b),DAY)],['person/1234']);
  assert.equal(r.has('1234'),false);
});
test('real EP final-vote labels from 2026 qualify, while amendments do not',()=>{
  const finalLabel = rec('199517',{
    activity_order:'35.0',
    activity_label:{it:'RC-B10-0476/2026 – Proposta di risoluzione (insieme del testo)',
      en:'RC-B10-0476/2026 – Motion for a resolution (as a whole)'},
    headingLabel:{it:'Gruppi parlamentari (nome non esponibile)'}
  });
  const amendment = rec('199504',{
    activity_order:'19.0',
    activity_label:{it:'RC-B10-0476/2026 – § 7/3',en:'RC-B10-0476/2026 – § 7/3'}
  });
  const result = parseOfficialDecisionBallots(body(amendment,finalLabel),DAY);
  assert.equal(result.length,2);
  assert.equal(result.find(x=>x.voteId.endsWith('199517')).final,true);
  assert.equal(result.find(x=>x.voteId.endsWith('199504')).final,false);
  assert.equal(result.find(x=>x.voteId.endsWith('199517')).officialOrder,35);
  assert.match(result.find(x=>x.voteId.endsWith('199517')).subject,/insieme del testo/);
  assert.doesNotMatch(result.find(x=>x.voteId.endsWith('199517')).subject,/Gruppi parlamentari/);
});

test('exact official agenda join adds a readable subject, never matches similar decision IDs',()=>{
  const decision = parseOfficialDecisionBallots(body(rec()),DAY);
  const joined = joinOfficialAgendaSubjects(decision,body({
    activity_label:{it:'Oggetto reale della risoluzione'},
    consists_of:['eli/dl/event/MTG-PL-2026-10-22-DEC-199569',
                 'eli/dl/event/MTG-PL-2026-10-22-DEC-1995699']
  }));
  assert.match(joined[0].subject,/Oggetto reale della risoluzione/);
  assert.equal(joinOfficialAgendaSubjects(decision,body({
    activity_label:{it:'Altra risoluzione'},
    consists_of:['eli/dl/event/MTG-PL-2026-10-22-DEC-1995699']
  }))[0].subject,decision[0].subject);
});

test('cache and concurrent deduplication are in-memory only',async()=>{
  let calls=0;
  const client={get:async url=>{
    calls++;
    return {status:200,data:url.endsWith('/decisions') ? body(rec()) :
      body({activity_label:{it:'Oggetto testato'},
        consists_of:['eli/dl/event/MTG-PL-2026-10-22-DEC-199569']})};
  }};
  const [a,b]=await Promise.all([fetchOfficialDecisionBallots(DAY,client),fetchOfficialDecisionBallots(DAY,client)]);
  assert.equal(calls,2);
  assert.match(a[0].subject,/Oggetto testato/);
  assert.equal(a.length,1);
  assert.equal(b.length,1);
});
