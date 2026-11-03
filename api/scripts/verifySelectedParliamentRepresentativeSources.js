'use strict';

// Public-source, read-only smoke checks for the two representatives selected
// in DEMOS on 03/11/2026. No credentials, user IDs or production DB access.
// This verifies ONLY the last known final vote at the dated snapshot, not
// guaranteed latest forever.
const assert = require('node:assert/strict');
const { fetchVerifiedFinalBallots } = require('../services/parliamentVerifiedFinalBallotsService');
const { matchUniqueMember } = require('../services/parliamentLatestVoteNotificationsService');

const scenarios = [
  {
    representative: { nome: 'Nicola', cognome: 'Fratoianni' },
    vote: { openpolis_id: 'vs19_735_017', camera: 'Camera', data_votazione: '2026-10-28' },
    expectedStatus: 'Assente', expectedSource: 'official'
  },
  {
    representative: { nome: 'Peppe', cognome: 'De Cristofaro' },
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
    const member = matchUniqueMember(representative, verified.members, [representative]);
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
