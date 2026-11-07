'use strict';

// Source coverage audit of all 14 final-vote IDs observed from DEMOS production
// on 03/11/2026. NO database access, credentials, local files or mutations.
// Failures are reported, never interpreted as an individual's voting position.
const { fetchVerifiedFinalBallots } = require('../services/parliamentVerifiedFinalBallotsService');

const snapshot = [
  ['vs19_735_017','Camera','2026-10-28'],
  ['19-469-3','Senato','2026-10-28'],
  ['19-469-6','Senato','2026-10-28'],
  ['19-468-4','Senato','2026-10-27'],
  ['vs19_730_097','Camera','2026-10-21'],
  ['vs19_727_034','Camera','2026-10-14'],
  ['19-463-35','Senato','2026-10-07'],
  ['vs19_718_024','Camera','2026-10-01'],
  ['vs19_714_031','Camera','2026-09-23'],
  ['vs19_710_001','Camera','2026-09-16'],
  ['19-454-8','Senato','2026-09-15'],
  ['vs19_707_037','Camera','2026-09-10'],
  ['vs19_704_039','Camera','2026-08-05'],
  ['vs19_703_080','Camera','2026-08-04']
];

async function main() {
  const results = [];
  for (const [openpolis_id, camera, data_votazione] of snapshot) {
    try {
      const data = await fetchVerifiedFinalBallots({ openpolis_id, camera, data_votazione });
      if (data.chamber !== camera || data.date !== data_votazione ||
          !['official','openpolis'].includes(data.source.type) ||
          data.members.length < 120) throw new Error('SOURCE_AUDIT_INCONSISTENT');
      results.push({
        id: openpolis_id, camera, status: 'VERIFIED',
        source: data.source.label, members: data.members.length
      });
    } catch (error) {
      const reason = String(error?.message || 'UNKNOWN').slice(0, 90);
      results.push({ id: openpolis_id, camera, status: 'UNAVAILABLE', reason });
    }
  }
  const verified = results.filter(r => r.status === 'VERIFIED').length;
  console.log('DEMOS_FINAL_BALLOT_COVERAGE',JSON.stringify({
    date: '2026-11-03', total: results.length, verified,
    unavailable: results.length - verified, results
  }));
  if (results.length !== 14 || verified < 2) {
    throw new Error('SOURCE_COVERAGE_MINIMUM_NOT_MET');
  }
}

main().catch(error => {
  console.error('DEMOS_FINAL_BALLOT_COVERAGE_FAIL', error.message);
  process.exitCode = 1;
});
