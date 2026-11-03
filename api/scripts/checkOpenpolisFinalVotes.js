'use strict';

const { fetchVotazioniFinaliDecisive } = require('../services/openpolisVotazioniFinaliService');

async function main() {
  const start = Date.now();
  const votes = await fetchVotazioniFinaliDecisive(12);
  if (votes.length < 4) throw new Error('OPENPOLIS_FINAL_VOTES_TOO_FEW:' + votes.length);
  const ids = new Set(votes.map(x => x.openpolis_id));
  if (ids.size !== votes.length) throw new Error('OPENPOLIS_DUPLICATE_VOTE_IDS');
  const invalid = votes.find(x => !x.url_dettaglio.startsWith('https://parlamento19.openpolis.it/votazioni/')
    || !['Camera', 'Senato'].includes(x.camera)
    || !['Approvata','Respinta'].includes(x.esito)
    || !/^\d{4}-\d{2}-\d{2}$/.test(x.data_votazione || ''));
  if (invalid) throw new Error('OPENPOLIS_INVALID_VOTE_RECORD');
  const dates = votes.map(x=>x.data_votazione).sort().reverse();
  console.log('Openpolis final-vote smoke:', JSON.stringify({
    parsed: votes.length, latest: dates[0], ids: Array.from(ids).slice(0,4),
    elapsedMs: Date.now() - start
  }));
}
main().catch(error => {
  console.error('Openpolis final-vote smoke failed:', error.message);
  process.exitCode = 1;
});
