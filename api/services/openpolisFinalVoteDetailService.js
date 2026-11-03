/**
 * Read-through cache for nominal votes on an already confirmed Openpolis final vote.
 * No inference from party or result. Secret ballots remain secret.
 */
'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const ORIGIN = 'https://parlamento19.openpolis.it';
const ID_PATTERN = /^(?:vs19_[A-Za-z0-9_-]+|19-\d+-\d+)$/;
const CACHE_HOURS = 24;
const inFlight = new Map();
let schemaPromise;

const normalize = text => String(text || '').replace(/\s+/g, ' ').trim();
const canonicalStatus = new Map([
  ['favorevole', 'Favorevole'],
  ['contrario', 'Contrario'],
  ['astenuto', 'Astenuto'],
  ['assente', 'Assente'],
  ['in missione', 'In missione'],
  ['non votante', 'Non votante'],
  ['presidente di turno', 'Presidente di turno'],
  ['votante in voto segreto', 'Votante in voto segreto']
]);

function parseOpenpolisFinalVoteDetail(html, expectedCamera) {
  if (typeof html !== 'string' || html.length < 100) throw new Error('OPENPOLIS_DETAIL_INVALID_HTML');
  const $ = cheerio.load(html);
  const body = normalize($('body').text());
  const beforeTables = body.split(/Come hanno votato i (?:gruppi|deputati|senatori|parlamentari)/i)[0].slice(0, 1800);
  const cameraMatch = beforeTables.match(/\b(Camera|Senato)\b/i);
  const camera = cameraMatch && cameraMatch[1].toLowerCase() === 'camera' ? 'Camera'
    : cameraMatch && cameraMatch[1].toLowerCase() === 'senato' ? 'Senato' : null;
  if (!camera || (expectedCamera && camera !== expectedCamera)) throw new Error('OPENPOLIS_DETAIL_CHAMBER_MISMATCH');
  const seduta = beforeTables.match(/Votazione\s*n\.?\s*(\d+)\s*\/\s*Seduta\s*n\.?\s*(\d+)\s*del\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const dataVotazione = seduta ? seduta[5] + '-' + seduta[4].padStart(2, '0') + '-' + seduta[3].padStart(2, '0') : null;
  const votoSegreto = /\bSEGRETO\b/i.test(beforeTables) || /Votante in voto segreto/i.test(body);
  const summary = {};
  for (const [key, label] of [['presenti', 'Presenti'], ['votanti', 'Votanti'], ['maggioranza', 'Maggioranza']]) {
    const match = beforeTables.match(new RegExp('(?:^|\\s)(\\d{1,4})\\s+' + label + '\\b', 'i'));
    summary[key] = match ? Number(match[1]) : null;
  }

  const nominal = [];
  const seen = new Set();
  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray();
    if (rows.length < 2) return;
    const heads = $(rows[0]).find('th,td').map((__, cell) => normalize($(cell).text()).toLowerCase()).get();
    const nameIx = heads.findIndex(value => /^(deputat[oa]|senator[ea]|parlamentare)$/.test(value));
    const votoIx = heads.findIndex(value => /^voto$/.test(value));
    const gruppoIx = heads.findIndex(value => /^gruppo$/.test(value));
    if (nameIx < 0 || votoIx < 0 || gruppoIx < 0) return;
    for (const row of rows.slice(1)) {
      const cells = $(row).children('td,th').toArray();
      if (cells.length <= Math.max(nameIx, votoIx, gruppoIx)) continue;
      const nome = normalize($(cells[nameIx]).text());
      const rawVoto = normalize($(cells[votoIx]).text()).toLowerCase();
      const voto = canonicalStatus.get(rawVoto);
      const gruppo = normalize($(cells[gruppoIx]).text());
      if (!nome || nome.length > 180 || !voto || seen.has(nome.toLocaleLowerCase('it'))) continue;
      const rawHref = $(cells[nameIx]).find('a[href]').first().attr('href') || '';
      let urlProfilo = null;
      try {
        const url = new URL(rawHref, ORIGIN);
        if (url.origin === ORIGIN && /^\/persone\/[a-z0-9_-]+\/?$/i.test(url.pathname)) urlProfilo = url.href;
      } catch {}
      seen.add(nome.toLocaleLowerCase('it'));
      nominal.push({ nome, voto, gruppo, url_profilo: urlProfilo });
    }
  });

  if (votoSegreto && nominal.some(item => item.voto === 'Favorevole' || item.voto === 'Contrario')) {
    throw new Error('OPENPOLIS_SECRET_VOTE_CONFLICT');
  }
  if (!nominal.length) throw new Error('OPENPOLIS_DETAIL_NOMINAL_EMPTY');
  return {
    camera, data_votazione: dataVotazione, voto_segreto: votoSegreto,
    riepilogo: summary, voti_nominali: nominal,
    voti_disponibili: nominal.length
  };
}

async function fetchAndParse(record) {
  if (!ID_PATTERN.test(record.openpolis_id)) throw new Error('OPENPOLIS_DETAIL_INVALID_ID');
  const url = ORIGIN + '/votazioni/' + record.openpolis_id;
  const response = await axios.get(url, {
    headers: { Accept: 'text/html', 'User-Agent': 'DEMOS/1.0 (civic public vote detail; https://demos.community)' },
    timeout: 15000, maxContentLength: 4 * 1024 * 1024,
    validateStatus: status => status >= 200 && status < 300
  });
  const detail = parseOpenpolisFinalVoteDetail(response.data, record.camera);
  const expectedDate = record.data_votazione instanceof Date
    ? record.data_votazione.toISOString().slice(0, 10)
    : record.data_votazione ? String(record.data_votazione).slice(0, 10) : null;
  if (!detail.data_votazione || (expectedDate && expectedDate !== detail.data_votazione)) {
    throw new Error('OPENPOLIS_DETAIL_DATE_MISMATCH');
  }
  // A tiny subset could indicate pagination, layout changes or an incomplete scrape.
  if (detail.voti_nominali.length < 20) throw new Error('OPENPOLIS_DETAIL_INCOMPLETE');
  return { ...detail, fonte_url: url };
}

async function ensureCacheTable(pool) {
  if (!schemaPromise) {
    schemaPromise = pool.query(
      'CREATE TABLE IF NOT EXISTS openpolis_votazioni_finali_dettagli (' +
      'openpolis_id VARCHAR(50) PRIMARY KEY REFERENCES openpolis_votazioni_finali_decisive(openpolis_id) ON DELETE CASCADE, ' +
      'contenuto JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'
    ).catch(err => { schemaPromise = undefined; throw err; });
  }
  await schemaPromise;
}

async function getOpenpolisFinalVoteDetail(pool, record) {
  if (!record || !ID_PATTERN.test(record.openpolis_id)) throw new Error('OPENPOLIS_DETAIL_INVALID_ID');
  await ensureCacheTable(pool);
  const { rows } = await pool.query(
    'SELECT contenuto, updated_at FROM openpolis_votazioni_finali_dettagli WHERE openpolis_id = $1',
    [record.openpolis_id]
  );
  const cached = rows[0];
  const ageMs = cached ? Date.now() - new Date(cached.updated_at).getTime() : Infinity;
  if (cached && ageMs >= 0 && ageMs < CACHE_HOURS * 3600000) {
    return { ...cached.contenuto, cache_stale: false, aggiornato_il: cached.updated_at };
  }
  if (!inFlight.has(record.openpolis_id)) {
    const promise = (async () => {
      try {
        const data = await fetchAndParse(record);
        await pool.query(
          'INSERT INTO openpolis_votazioni_finali_dettagli (openpolis_id, contenuto, updated_at) VALUES ($1, $2::jsonb, NOW()) ' +
          'ON CONFLICT (openpolis_id) DO UPDATE SET contenuto = EXCLUDED.contenuto, updated_at = NOW()',
          [record.openpolis_id, JSON.stringify(data)]
        );
        return { ...data, cache_stale: false, aggiornato_il: new Date().toISOString() };
      } catch (error) {
        if (cached && cached.contenuto) {
          return { ...cached.contenuto, cache_stale: true, aggiornato_il: cached.updated_at };
        }
        throw error;
      }
    })();
    inFlight.set(record.openpolis_id, promise);
    promise.finally(() => {
      if (inFlight.get(record.openpolis_id) === promise) inFlight.delete(record.openpolis_id);
    }).catch(() => {});
  }
  return inFlight.get(record.openpolis_id);
}

module.exports = { ID_PATTERN, parseOpenpolisFinalVoteDetail, fetchAndParse, getOpenpolisFinalVoteDetail };
