'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertVerifiedVote, UPSERT_CURRENT_VOTE_SQL, UPSERT_SELECTED_PE_CURRENT_VOTE_SQL,
  upsertVerifiedCurrentVote, getCurrentVote } =
  require('../services/institutionalCurrentNominalVotesService');

const base = {
  institution: 'Camera',
  representativeKey: 'demos:00000000-0000-4000-8000-000000000001',
  sourcePersonId: 'http://dati.camera.it/ocd/deputato.rdf/d123',
  ballotId: 'vs19_730_097', voteDate: '2026-10-21', ballotOrder: 73000097,
  status: 'Favorevole', ballotTitle: 'Votazione finale verificata', ballotOutcome:'Approvata',
  sourceUrl: 'https://documenti.camera.it/apps/votazioni/123',
  sourceType: 'camera_ufficiale', verified: true
};

test('fail-closed verification: no guessed vote, name-only key, wrong source, malformed date', async () => {
  for (const bad of [
    { representativeKey: 'Mario Rossi' }, { status: 'Segreto' },
    { status: 'Ignoto' }, { verified: false }, { sourceType: 'senato_openpolis' },
    { sourceUrl: 'https://evil.test/vote' }, { voteDate: '2026-02-31' },
    { ballotOrder: null }, { institution: 'Sconosciuto' },
    { sourcePersonId:null }, {sourcePersonId:'Mario Rossi'}, {sourcePersonId:'https://evil.test/persone/123'}, {ballotOutcome:' '}, {ballotOutcome:123}
  ]) {
    const input = { ...base, ...bad };
    assert.throws(() => assertVerifiedVote(input), /CURRENT_VOTE_/);
    await assert.rejects(upsertVerifiedCurrentVote({
      query: async () => { throw new Error('must not write'); }
    }, input), /CURRENT_VOTE_/);
  }
});

test('atomic statement uses stable key and ordering guard, never appends history', () => {
  assert.match(UPSERT_CURRENT_VOTE_SQL, /ON CONFLICT \(representative_key\)/);
  assert.match(UPSERT_CURRENT_VOTE_SQL, /vote_date < EXCLUDED.vote_date/);
  assert.match(UPSERT_CURRENT_VOTE_SQL, /ballot_order < EXCLUDED.ballot_order/);
  assert.match(UPSERT_CURRENT_VOTE_SQL, /institutional_current_nominal_votes.institution = EXCLUDED.institution/);
  assert.match(UPSERT_CURRENT_VOTE_SQL, /institution = EXCLUDED.institution/);
  assert.doesNotMatch(UPSERT_CURRENT_VOTE_SQL, /nome_completo|gruppo_politico|politico_nome/);
  assert.match(UPSERT_CURRENT_VOTE_SQL,/ballot_outcome = EXCLUDED.ballot_outcome/);
});

test('same representative is keyed separately from human-readable names', async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push({sql,params}); return {rows:[{ballot_id:params[3]}]}; } };
  await upsertVerifiedCurrentVote(db, base);
  await upsertVerifiedCurrentVote(db, { ...base, representativeKey:
    'demos:00000000-0000-4000-8000-000000000002' });
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].params[1], calls[1].params[1]);
  assert.equal(calls[0].params[3], 'vs19_730_097');
});


test('PE accepts only canonical DEMOS key, official source and explicit vote', async () => {
  const ep = { ...base, institution:'PE',
    representativeKey:'demos:00000000-0000-4000-8000-000000000005',
    sourcePersonId:'12345', ballotId:'MTG-PL-2026-11-08-DEC-123',
    voteDate:'2026-11-08', ballotOrder:1,
    sourceUrl:'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-2026-11-08/decisions',
    sourceType:'pe_ufficiale', status:'Astenuto' };
  assert.equal(assertVerifiedVote(ep).representativeKey,ep.representativeKey);
  for (const bad of [
    {representativeKey:'pe:12345'}, {representativeKey:'demos:non-uuid'},
    {representativeKey:'official:person/12345'}, {sourcePersonId:'012345'},
    {sourcePersonId:'person/12345'}, {status:'Assente'}
  ]) {
    const attempt={...ep,...bad};
    assert.throws(()=>assertVerifiedVote(attempt),/CURRENT_VOTE_/);
    await assert.rejects(upsertVerifiedCurrentVote({
      query:async()=>{throw Error('DATABASE_SHOULD_NOT_BE_QUERIED')}
    },attempt),/CURRENT_VOTE_/);
  }
  await assert.rejects(getCurrentVote({
    query:async()=>{throw Error('DATABASE_SHOULD_NOT_BE_QUERIED')}
  },'PE','pe:12345'),/CURRENT_VOTE_INVALID_LOOKUP/);
});

test('PE writes recheck the approved official identity and active follower atomically', async () => {
  assert.match(UPSERT_SELECTED_PE_CURRENT_VOTE_SQL,/WITH authorized_pe AS MATERIALIZED/);
  assert.match(UPSERT_SELECTED_PE_CURRENT_VOTE_SQL,/l.source_person_id = \$3/);
  assert.match(UPSERT_SELECTED_PE_CURRENT_VOTE_SQL,/review_state = 'VERIFIED'/);
  assert.match(UPSERT_SELECTED_PE_CURRENT_VOTE_SQL,/reviewed_by IS NOT NULL/);
  assert.match(UPSERT_SELECTED_PE_CURRENT_VOTE_SQL,/political_office_id = 'eu.parliament.it'/);
  assert.match(UPSERT_SELECTED_PE_CURRENT_VOTE_SQL,/FOR SHARE OF l/);
  assert.match(UPSERT_SELECTED_PE_CURRENT_VOTE_SQL,/FOR SHARE OF ps, follower/);
  assert.match(UPSERT_SELECTED_PE_CURRENT_VOTE_SQL,/ON CONFLICT \(representative_key\)/);
  const ep={...base,institution:'PE',
    representativeKey:'demos:00000000-0000-4000-8000-000000000005',
    sourcePersonId:'12345', sourceType:'pe_ufficiale',
    sourceUrl:'https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-2026-11-08/decisions',
    status:'Favorevole'};
  const statements=[];
  const result=await upsertVerifiedCurrentVote({query:async(sql,params)=>{
    statements.push({sql,params});return {rows:[]};
  }},ep);
  assert.equal(result.changed,false);
  assert.equal(statements.length,1);
  assert.equal(statements[0].sql,UPSERT_SELECTED_PE_CURRENT_VOTE_SQL);
  assert.equal(statements[0].params[1],ep.representativeKey);
  assert.equal(statements[0].params[2],'12345');
});
