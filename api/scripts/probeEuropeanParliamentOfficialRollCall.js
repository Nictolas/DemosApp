'use strict';
/**
 * Read-only official XML probe, no DB credentials and no user data.
 * A 200 response alone is insufficient: parse a non-empty RCV file.
 */
const { fetchOfficialSittingRcv } = require('../services/europeanParliamentVerifiedRollCallReader');

(async () => {
  const sitting = process.env.EP_RCV_SITTING || '2026-07-09';
  const votes = await fetchOfficialSittingRcv(sitting);
  const memberIds = new Set();
  for (const vote of votes) {
    for (const id of vote.ballots.keys()) memberIds.add(id);
  }
  if (votes.length === 0 || memberIds.size < 100) {
    throw new Error('EP_OFFICIAL_RCV_TOO_FEW_VERIFIED_RECORDS');
  }
  console.log('EP_OFFICIAL_RCV_READ_ONLY_OK', JSON.stringify({
    sitting, rollCalls: votes.length, distinctMepIds: memberIds.size,
    attribution: 'stable MepId only', finalOutcomes: 'NOT_VERIFIED_BY_RCV_ALONE',
    databaseWrites: 0, personalVoteHistory: false
  }));
})().catch(err => {
  console.error('EP_OFFICIAL_RCV_READ_ONLY_FAILED', err.code || err.message);
  process.exitCode = 1;
});
