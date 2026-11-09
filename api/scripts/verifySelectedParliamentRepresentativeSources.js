'use strict';

// Public-source, read-only smoke checks for the two representatives selected
// in DEMOS on 03/11/2026. No credentials, user IDs or production DB access.
// This verifies ONLY the last known final vote at the dated snapshot, not
// guaranteed latest forever. Official Camera status 'Non ha partecipato'
// differs from Openpolis's approximate 'Assente'; official source wins.
const assert = require('node:assert/strict');
const { fetchVerifiedFinalBallots } = require('../services/parliamentVerifiedFinalBallotsService');
const { matchUniqueMember } = require('../services/parliamentLatestVoteNotificationsService');

const scenarios = [
  {
    representative: { nome: 'Nicola', cognome: 'Fratoianni',
      source_person_id: 'https://www.camera.it/deputati/elenco/19-305880',
      evidence_url: 'https://www.camera.it/deputati/elenco/19-305880' },
    vote: { openpolis_id: 'vs19_735_017', camera: 'Camera', data_votazione: '2026-10-28' },
    expectedStatus: 'Non ha partecipato', expectedSource: 'official'
  },
  {
    representative: { nome: 'Peppe', cognome: 'De Cristofaro',
      source_person_id: 'https://parlamento19.openpolis.it/persone/peppe-de-cristofaro-1971-06-26',
      evidence_url: 'https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=22918' },
    vote: { openpolis_id: '19-469-6', camera: 'Senato', data_votazione: '2026-10-28' },
    expectedStatus: 'Favorevole', expectedSource: 'openpolis'
  }
];

async function main() {
  for (const scenario of scenarios) {
    const { representative, vote, expectedStatus, expectedSource } = scenario;
    const verified = await fetchVerifiedFinalBallots(vote);
    assert.equal(verified.voteId, vote.openpolis_id);
    assert.equal(verified.chamber, vote.camera);
    assert.equal(verified.date, vote.data_votazione);
    assert.equal(verified.source.type, expectedSource);
    // Public source smoke ONLY: source IDs are screening examples, not
    // approvals for live DEMOS institutional identity links.
    const member = matchUniqueMember(representative, verified.members,
      [representative], { chamber:vote.camera, sourceType:verified.source.type });
    assert.ok(member, 'NO_UNAMBIGUOUS_MEMBER_RECORD');
    assert.equal(member.vote, expectedStatus, 'FINAL_ROLLCALL_STATUS_CHANGED');
    console.log('FINAL_REPRESENTATIVE_SOURCE_VERIFIED', JSON.stringify({
      chamber: vote.camera, voteId:vote.openpolis_id, date:vote.data_votazione,
      source:verified.source.label, status:member.vote
    }));
  }
}
main().catch(e => {
  console.error('FINAL_REPRESENTATIVE_SOURCE_UNAVAILABLE', String(e?.message || 'UNKNOWN').slice(0,90));
  process.exitCode = 1;
});
