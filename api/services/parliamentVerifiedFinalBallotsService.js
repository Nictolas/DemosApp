'use strict';

// Read-only, fail-closed acquisition of individual votes for final ballots.
// CAMERA: institutional Camera roll-call record. SENATO: Openpolis record,
// labelled as such because the institutional website does not reliably return
// a usable roster to automated requests. Never infer votes from party/group.
const axios = require('axios');
const cheerio = require('cheerio');

const voteIdPattern = /^(?:vs19_\d{1,5}_\d{1,5}|19-\d{1,5}-\d{1,5})$/;
const statuses = new Set([
  'Favorevole', 'Contrario', 'Astensione', 'Astenuto', 'Assente',
  'In missione', 'In congedo', 'Non ha partecipato',
  'Presente non votante', 'Presidente di turno'
]);
const ttlMs = 12 * 60 * 60 * 1000;
const maxCacheSize = 60;
const cache = new Map();
const inFlight = new Map();

function parseVerifiedFinalBallots(html, vote) {
  if (typeof html !== 'string' || !html || !voteIdPattern.test(vote?.openpolis_id || '')) {
    throw new Error('VOTE_SOURCE_INVALID_INPUT');
  }
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const senate = vote.camera === 'Senato';
  const camera = vote.camera === 'Camera';
  if (!senate && !camera) throw new Error('VOTE_SOURCE_INVALID_CHAMBER');

  let source;
  let expectedHeaders;
  if (camera) {
    const parts = vote.openpolis_id.match(/^vs19_(\d{1,5})_(\d{1,5})$/);
    if (!parts) throw new Error('VOTE_SOURCE_CHAMBER_MISMATCH');
    const session = String(Number(parts[1])), number = String(Number(parts[2]));
    if (!new RegExp('Votazione\\s+finale\\s+nominale\\s+n\\.?\\s*' + number + '(?=\\D)', 'i').test(text) ||
        !new RegExp('seduta\\s+n\\.?\\s*' + session + '(?=\\D)', 'i').test(text)) {
      throw new Error('VOTE_SOURCE_ID_MISMATCH');
    }
    source = {
      type: 'official', label: 'Camera dei deputati',
      url: 'https://documenti.camera.it/apps/votazioni/votazionitutte/schedaVotazione.asp?' +
        'CDDNATURA=FINALE&Legislatura=19&RifVotazione=' + session + '_' + number + '&tipo=dettaglio'
    };
    expectedHeaders = ['nominativo', 'gruppo', 'voto'];
  } else {
    const parts = vote.openpolis_id.match(/^19-(\d{1,5})-(\d{1,5})$/);
    if (!parts) throw new Error('VOTE_SOURCE_CHAMBER_MISMATCH');
    const session = String(Number(parts[1])), number = String(Number(parts[2]));
    if (!new RegExp('Votazione\\s+n\\.?\\s*' + number + '\\s*\\/\\s*Seduta\\s+n\\.?\\s*' + session, 'i').test(text) ||
        !/VOTO\s+FINALE/i.test(text)) {
      throw new Error('VOTE_SOURCE_ID_MISMATCH');
    }
    source = { type: 'openpolis', label: 'Openpolis', url: 'https://parlamento19.openpolis.it/votazioni/' + vote.openpolis_id };
    expectedHeaders = ['senatore', 'voto', 'gruppo'];
  }

  if (!vote.data_votazione) throw new Error('VOTE_SOURCE_DATE_MISSING');
  const iso = String(vote.data_votazione).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('VOTE_SOURCE_INVALID_DATE');
  const expectedDate = iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  if (!text.includes(expectedDate)) throw new Error('VOTE_SOURCE_DATE_MISMATCH');

  let rows;
  $('table').each((_, table) => {
    if (rows) return;
    const $table = $(table);
    const first = $table.find('tr').first();
    const headers = first.find('th,td').toArray().map(el => $(el).text().replace(/\s+/g, ' ').trim().toLowerCase());
    if (!expectedHeaders.every((h, i) => headers[i] === h)) return;
    rows = $table.find('tr').slice(1).toArray().map(tr => {
      const cells = $(tr).find('td').toArray().map(td => $(td).text().replace(/\s+/g, ' ').trim());
      if (cells.length < 3) return null;
      const name = cells[0], group = senate ? cells[2] : cells[1];
      const status = senate ? cells[1] : cells[2];
      if (!name || name.length < 4 || name.length > 150 || !statuses.has(status) ||
          !group || group.length > 90) throw new Error('VOTE_SOURCE_UNRECOGNIZED_ROW');
      return { name, group, vote: status };
    }).filter(Boolean);
  });
  if (!rows || rows.length < 120 || rows.length > 700) throw new Error('VOTE_SOURCE_ROLLCALL_MISSING');
  const names = new Set(rows.map(r => r.name.trim().toLocaleLowerCase('it')));
  if (names.size !== rows.length) throw new Error('VOTE_SOURCE_DUPLICATE_MEMBERS');

  return { source, voteId: vote.openpolis_id, date: iso, chamber: vote.camera, members: rows };
}

function decodeHtml(response, sourceType) {
  const bytes = Buffer.from(response.data);
  if (bytes.length < 200) throw new Error('VOTE_SOURCE_EMPTY_RESPONSE');
  const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
  const encoding = sourceType === 'official' && !contentType.includes('utf-8') ? 'windows-1252' : 'utf-8';
  return new TextDecoder(encoding).decode(bytes);
}

async function fetchVerifiedFinalBallots(vote) {
  if (!vote || !voteIdPattern.test(vote.openpolis_id) || !['Camera', 'Senato'].includes(vote.camera)) {
    throw new Error('VOTE_SOURCE_INVALID_VOTE');
  }
  // Database row is the authority for the chamber and vote date.
  const senate = vote.camera === 'Senato';
  const idMatch = vote.openpolis_id.match(senate ? /^19-(\d+)-(\d+)$/ : /^vs19_(\d+)_(\d+)$/);
  if (!idMatch) throw new Error('VOTE_SOURCE_CHAMBER_MISMATCH');
  const url = senate
    ? 'https://parlamento19.openpolis.it/votazioni/' + vote.openpolis_id
    : 'https://documenti.camera.it/apps/votazioni/votazionitutte/schedaVotazione.asp?' +
       'CDDNATURA=FINALE&Legislatura=19&RifVotazione=' +
       Number(idMatch[1]) + '_' + Number(idMatch[2]) + '&tipo=dettaglio';
  const response = await axios.get(url, {
    timeout: 12000, maxRedirects: 0, responseType: 'arraybuffer',
    headers: { 'User-Agent': 'DEMOS/1.0 (verified parliamentary votes; https://demos.community)' },
    validateStatus: status => status === 200,
    maxContentLength: 2000000
  });
  const html = decodeHtml(response, senate ? 'openpolis' : 'official');
  return parseVerifiedFinalBallots(html, vote);
}

async function getVerifiedFinalBallots(vote) {
  const key = vote.openpolis_id;
  if (!voteIdPattern.test(key || '')) throw new Error('VOTE_SOURCE_INVALID_ID');
  const previous = cache.get(key);
  if (previous && previous.expires > Date.now() && previous.data.date === String(vote.data_votazione).slice(0, 10)) {
    return previous.data;
  }
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = fetchVerifiedFinalBallots(vote).then(data => {
    if (cache.size >= maxCacheSize) cache.delete(cache.keys().next().value);
    cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

module.exports = { parseVerifiedFinalBallots, fetchVerifiedFinalBallots, getVerifiedFinalBallots };
