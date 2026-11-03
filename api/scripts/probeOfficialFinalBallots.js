'use strict';
const axios = require('axios');
const cheerio = require('cheerio');

const endpoints = [
  {
    id: 'camera-730-97',
    url: 'https://documenti.camera.it/apps/votazioni/votazionitutte/schedaVotazione.asp?CDDNATURA=FINALE&Legislatura=19&RifVotazione=730_97&tipo=dettaglio',
    host: 'documenti.camera.it'
  },
  {
    id: 'senato-469-3',
    url: 'https://www.senato.it/leggi-e-documenti/disegni-di-legge/scheda-ddl/votazione?did=59909&sessionId=469&voteId=3',
    host: 'www.senato.it'
  },
  {
    id: 'openpolis-469-3',
    url: 'https://parlamento19.openpolis.it/votazioni/19-469-3',
    host: 'parlamento19.openpolis.it'
  }
];

(async () => {
  for (const p of endpoints) {
    try {
      const response = await axios.get(p.url, { timeout: 12000, maxRedirects: 2,
        headers: { 'User-Agent': 'DEMOS/1.0 (open-data QA; https://demos.community)' } });
      const url = new URL(response.request?.res?.responseUrl || p.url);
      if (url.hostname !== p.host) throw new Error('HOST_CHANGED');
      const $ = cheerio.load(response.data);
      const main = $('main').first().length ? $('main').first() : $('body');
      const tables = $('table').toArray().map(t => {
        const x = $(t), rows = x.find('tr');
        return { tr: rows.length, caption: x.find('caption').first().text().trim().slice(0, 110),
          headers: rows.first().find('th,td').toArray().map(e=>$(e).text().replace(/\s+/g,' ').trim().slice(0,65)).slice(0,6),
          examples: rows.slice(1,3).toArray().map(tr=>$(tr).find('td,th').toArray().map(e=>$(e).text().replace(/\s+/g,' ').trim().slice(0,65)).slice(0,6))
        };
      });
      const officialLinks = $('a[href]').toArray().map(e=>$(e).attr('href')||'')
        .filter(h=>/senato\.it|camera\.it/.test(h)).slice(0,8).map(h=>h.slice(0,210));
      const txt = main.text().replace(/\s+/g, ' ').trim();
      console.log('OFFICIAL_VOTE_PROBE', JSON.stringify({
        id: p.id, status:response.status, bytes: String(response.data).length,
        title:$('title').first().text().trim().slice(0,130),
        bodyIntro:txt.slice(0,600),
        nominativeIndicators:['Hanno votato a favore','Riepilogo dei voti espressi dai deputati','Nominativo','Favor'].filter(t=>txt.includes(t)),
        tables:tables.slice(0,7),officialLinks
      }));
    } catch(error) {
      console.error('OFFICIAL_VOTE_PROBE_FAILED',p.id,error.response?.status||error.message);
      process.exitCode=1;
    }
  }
})();
