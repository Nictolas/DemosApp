'use strict';
// Read-only live source checks. No database, credentials, or mutation.
const { fetchAndParse } = require('../services/openpolisFinalVoteDetailService');

async function main() {
  const cases = [
    { openpolis_id: 'vs19_735_017', camera: 'Camera', data_votazione: '2026-10-28', secret: false },
    { openpolis_id: 'vs19_691_001', camera: 'Camera', data_votazione: '2026-07-16', secret: true }
  ];
  for (const vote of cases) {
    const data = await fetchAndParse(vote);
    if (data.voto_segreto !== vote.secret || data.voti_nominali.length < 20) {
      throw new Error('OPENPOLIS_DETAIL_SMOKE_UNEXPECTED_RESULT_' + vote.openpolis_id);
    }
    console.log('[Openpolis detail smoke]', vote.openpolis_id,
      'participants=' + data.voti_nominali.length, 'secret=' + data.voto_segreto);
  }
}
main().catch(error => {
  console.error('Openpolis detail smoke failed:', error.message);
  process.exitCode = 1;
});
