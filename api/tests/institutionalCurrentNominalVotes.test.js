'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertVerifiedVote, UPSERT_CURRENT_VOTE_SQL, upsertVerifiedCurrentVote } =
  require('../services/institutionalCurrentNominalVotesService');

const base = {
  institution: 'Camera',
  representativeKey: 'demos:00000000-0000-4000-8000-000000000001',
  sourcePersonId: 'http://dati.camera.it/ocd/deputato.rdf/d123',
  ballotId: 'vs19_730_097', voteDate: '2026-10-21', ballotOrder: 73000097,
  status: 'Favorevole', ballotTitle: 'Votazione finale verificata',
  sourceUrl: 'https://documenti.camera.it/apps/votazioni/123',
  sourceType: 'camera_ufficiale', verified: true
};

test('fail-closed verification: no guessed vote, name-only key, wrong source, malformed date', async () => {
  for (const bad of [
    { representativeKey: 'Mario Rossi' }, { status: 'Segreto' },
    { status: 'Ignoto' }, { verified: false }, { sourceType: 'senato_openpolis' },
    { sourceUrl: 'https://evil.test/vote' }, { voteDate: '2026-02-31' },
    { ballotOrder: null }, { institution: 'Sconosciuto' },
    { sourcePersonId:null }, {sourcePersonId:'Mario Rossi'}, {sourcePersonId:'https://evil.test/persone/123'}
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

test('EP accepts only official source with stable MEP identifier', () => {
  const ep = { ...base, institution:'PE', representativeKey:'pe:12345',
    sourcePersonId:'12345', ballotId:'MTG-PL-2026-11-08-ITM-123',
    voteDate:'2026-11-08', ballotOrder:1,
    sourceUrl:'https://data.europarl.europa.eu/api/v2/vote-results/MTG',
    sourceType:'pe_ufficiale', status:'Astenuto' };
  assert.equal(assertVerifiedVote(ep).representativeKey,'pe:12345');
  assert.throws(() => assertVerifiedVote({...ep, representativeKey:'Giulia Bianchi'}),/STABLE_ID/);
});
