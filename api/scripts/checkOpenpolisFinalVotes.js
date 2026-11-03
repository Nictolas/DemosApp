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
    elapsedMs: Date.now() - start,
    verifiedRows: votes.map(v => ({ id: v.openpolis_id, camera: v.camera, titolo: v.titolo, esito: v.esito, data: v.data_votazione, url: v.url_dettaglio }))
  }));
}
main().catch(async error => {
  console.error('Openpolis final-vote smoke failed:', error.message);
  try {
    const cheerio = require('cheerio');
    const { fetchListaVotazioniFinali } = require('../services/openpolisVotazioniFinaliService');
    const html = await fetchListaVotazioniFinali(1);
    const $ = cheerio.load(html);
    const voteLinks = $('a[href]').toArray().filter(el => ($(el).attr('href') || '').includes('/votazioni/'));
    const sample = voteLinks.slice(0, 4).map(el => {
      const a = $(el);
      let node = a;
      const parents = [];
      for (let k = 0; k < 6 && node.length; k++, node = node.parent()) {
        const txt = node.text().replace(/\s+/g, ' ').trim();
        parents.push({ tag: node[0]?.tagName, text: txt.slice(0, 330), length: txt.length });
      }
      return { href: a.attr('href')?.slice(0, 140), parents };
    });
    console.error('Openpolis public DOM diagnostic:', JSON.stringify({
      bytes: html.length,
      title: $('title').text().slice(0, 120),
      totalLinks: $('a[href]').length,
      voteLinks: voteLinks.length,
      bodyIntro: $('body').text().replace(/\s+/g, ' ').trim().slice(0, 450),
      nextDataLength: $('#__NEXT_DATA__').text().length,
      sample
    }));
  } catch (diagnosticError) {
    console.error('DOM diagnostic unavailable:', diagnosticError.message);
  }
  process.exitCode = 1;
});
