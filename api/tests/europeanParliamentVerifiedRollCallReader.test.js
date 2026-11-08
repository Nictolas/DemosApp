'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canonicalMepId, officialRcvUrl, parseOfficialRollCallXml,
  selectLatestVerifiedByMep, fetchOfficialSittingRcv
} = require('../services/europeanParliamentVerifiedRollCallReader');

const DAY = '2026-10-22';
const URL = officialRcvUrl(DAY);
const rcv = `<?xml version="1.0" encoding="UTF-8"?>
<PV.RollCallVoteResults>
 <RollCallVote.Result Identifier="400">
  <RollCallVote.Description.Text>Final vote on a report</RollCallVote.Description.Text>
  <Result.For Number="1"><Result.PoliticalGroup.List><PoliticalGroup.Member.Name MepId="1234">One</PoliticalGroup.Member.Name></Result.PoliticalGroup.List></Result.For>
  <Result.Against Number="1"><Result.PoliticalGroup.List><PoliticalGroup.Member.Name MepId="5678">Two</PoliticalGroup.Member.Name></Result.PoliticalGroup.List></Result.Against>
  <Result.Abstention Number="1"><Result.PoliticalGroup.List><PoliticalGroup.Member.Name MepId="9012">Three</PoliticalGroup.Member.Name></Result.PoliticalGroup.List></Result.Abstention>
 </RollCallVote.Result>
 <RollCallVote.Result Identifier="401">
  <RollCallVote.Description.Text>Amendment only</RollCallVote.Description.Text>
  <Result.For><Result.PoliticalGroup.List><PoliticalGroup.Member.Name MepId="1234">One</PoliticalGroup.Member.Name></Result.PoliticalGroup.List></Result.For>
 </RollCallVote.Result>
</PV.RollCallVoteResults>`;

function officialDecision(id, subject = 'Final vote on a report') {
  return [`${DAY}:${id}`, {final: true, outcome: 'Approvato', sourceType:'EP_OFFICIAL_VOT', sourceUrl: 'https://www.europarl.europa.eu/doceo/document/PV-10-2026-10-22-VOT_EN.xml', subject}];
}

test('accepts only stable numeric MEP IDs, rejects substrings, names, and arbitrary URLs', () => {
  assert.equal(canonicalMepId('person/1234'), '1234');
  assert.equal(canonicalMepId('12345'), '12345');
  assert.equal(canonicalMepId('https://other.example/person/1234'), null);
  assert.equal(canonicalMepId('1234foo'), null);
  assert.equal(canonicalMepId('01234'), null);
  assert.equal(canonicalMepId(''), null);
});

test('requires real 10th-term sitting date and official source', () => {
  assert.throws(()=>officialRcvUrl('2026-02-30'), /INVALID_EP_SITTING_DATE/);
  assert.throws(()=>officialRcvUrl('2023-01-01'), /INVALID_EP_SITTING_DATE/);
  assert.throws(()=>parseOfficialRollCallXml(rcv, DAY, 'https://example.com/fake.xml'), /UNTRUSTED/);
});

test('parses vote positions by MepId only; never adds implicit absence or party', () => {
  const votes = parseOfficialRollCallXml(rcv, DAY);
  assert.equal(votes.length, 2);
  assert.equal(votes[0].ballots.get('1234'), 'Favorevole');
  assert.equal(votes[0].ballots.get('5678'), 'Contrario');
  assert.equal(votes[0].ballots.get('9012'), 'Astenuto');
  assert.equal(votes[0].ballots.get('9999'), undefined);
  assert.equal(JSON.stringify([...votes[0].ballots]), '[["1234","Favorevole"],["5678","Contrario"],["9012","Astenuto"]]');
  assert.equal(votes[0].sourceUrl, URL);
});

test('fails closed on duplicate conflicting roll-call position', () => {
  const duplicated = rcv.replace('<Result.Against Number="1">', '<Result.Against Number="1"><PoliticalGroup.Member.Name MepId="1234">One Again</PoliticalGroup.Member.Name>');
  const votes = parseOfficialRollCallXml(duplicated, DAY);
  assert.deepEqual(votes.map(x=>x.identifier), ['401']);
});

test('rejects duplicate roll-call IDs and non-RCV content', () => {
  assert.throws(()=>parseOfficialRollCallXml(rcv.replace('Identifier="401"', 'Identifier="400"'),DAY), /DUPLICATE/);
  assert.throws(()=>parseOfficialRollCallXml('<html><body>blocked</body></html>',DAY), /INVALID_DOCUMENT|WRONG_DOCUMENT/);
});

test('only explicit final official VOT outcome + exact subject unlocks individual vote', () => {
  const votes = parseOfficialRollCallXml(rcv, DAY);
  assert.equal(selectLatestVerifiedByMep([votes],['1234','5678','9012'],new Map()).size,0);
  const verified = new Map([officialDecision('400')]);
  const found = selectLatestVerifiedByMep([votes],['person/1234','5678','9012','9999'],verified);
  assert.equal(found.size, 3);
  assert.equal(found.get('1234').vote, 'Favorevole');
  assert.equal(found.get('5678').outcome, 'Approvato');
  assert.equal(found.get('9999'), undefined);
  assert.equal(found.get('1234').party, undefined);
  assert.equal(found.get('1234').group, undefined);
  const wrongSubject = new Map([officialDecision('400','Not the same')]);
  assert.equal(selectLatestVerifiedByMep([votes],['1234'],wrongSubject).size,0);
});

test('older results never overwrite a newer verified final vote', () => {
  const votes = parseOfficialRollCallXml(rcv, DAY);
  const older = votes.map(x=>({ ...x, date:'2026-10-21' }));
  const decisions = new Map([officialDecision('400'),
    ['2026-10-21:400', {...officialDecision('400')[1],subject:'Final vote on a report'}]]);
  const result = selectLatestVerifiedByMep([older,votes],['1234'],decisions);
  assert.equal(result.get('1234').date, DAY);
});

test('deduplicates in-flight HTTP requests and caches per sitting without writes', async () => {
  let requests=0;
  const mock={get:async (url,options)=>{requests++;assert.equal(url,URL);assert.equal(options.maxRedirects,0);return {status:200,data:rcv};}};
  const [a,b]=await Promise.all([fetchOfficialSittingRcv(DAY,mock),fetchOfficialSittingRcv(DAY,mock)]);
  assert.equal(requests,1);
  assert.equal(a.length,2);
  assert.equal(b.length,2);
  await fetchOfficialSittingRcv(DAY,mock);
  assert.equal(requests,1);
});
