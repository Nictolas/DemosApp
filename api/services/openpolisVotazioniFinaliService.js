/**
 * Servizio per recuperare le votazioni finali decisive da Openpolis.
 * Lista: /votazioni?main_vote_type=is_final — Dettaglio: /votazioni/vs19_xxx o /votazioni/19-xxx-x
 */

const axios = require('axios');
const cheerio = require('cheerio');

const OPENPOLIS_BASE = 'https://parlamento19.openpolis.it';
const LISTA_VOTI_FINALI = `${OPENPOLIS_BASE}/votazioni?main_vote_type=is_final&ordering=-date&page_size=50`;

/**
 * Fetch della pagina lista "Voto finale" (solo votazioni finali decisive: Approvata/Respinta).
 */
async function fetchListaVotazioniFinali(page = 1) {
  const url = LISTA_VOTI_FINALI + '&page=' + Math.max(1, Math.floor(Number(page) || 1));
  const { data } = await axios.get(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'DEMOS/1.0 (civic vote importer; https://demos.community)'
    },
    timeout: 15000,
    // An upstream 403/404 is an error, not an "empty successful sync".
    validateStatus: status => status >= 200 && status < 300
  });
  if (typeof data !== 'string' || data.length < 100) {
    throw new Error('OPENPOLIS_INVALID_HTML');
  }
  return data;
}

const detailIdPattern = /^(?:vs19_[A-Za-z0-9_-]+|19-\d+-\d+)$/;
const finalMarker = /votazion[e]?\s+final[e]?(?:\s+segreto)?/i;
const completeDate = /Seduta\s*n\.?\s*\d+\s+del\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i;
const resultMarker = /VOTAZIONE\s+FINALE(?:\s+SEGRETO)?\s*(Approvata|Respinta)/i;

function parseListaVotazioniFinali(html) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  const detailId = href => {
    try {
      const url = new URL(href, OPENPOLIS_BASE);
      if (url.origin !== OPENPOLIS_BASE) return null;
      const m = url.pathname.match(/^\/votazioni\/([^/]+)\/?$/);
      return m && detailIdPattern.test(m[1]) ? m[1] : null;
    } catch { return null; }
  };

  // On Openpolis the text "Camera / Seduta / Approvata" can be adjacent to
  // the link, not inside it. Walk only the smallest one-vote card; do NOT
  // parse the entire list container (which could misattribute another vote).
  $('a[href]').each((_, el) => {
    const anchor = $(el);
    const id = detailId(anchor.attr('href') || '');
    if (!id || seen.has(id)) return;

    let cardText = '';
    let node = anchor;
    for (let depth = 0; depth < 9 && node.length; depth++, node = node.parent()) {
      const text = node.text().replace(/\s+/g, ' ').trim();
      if (!text || text.length > 2800) continue;

      const links = new Set();
      node.find('a[href]').each((__, candidate) => {
        const otherId = detailId($(candidate).attr('href') || '');
        if (otherId) links.add(otherId);
      });
      if (node.is('a[href]')) links.add(id);
      if (links.size !== 1 || !links.has(id)) continue;

      if (/^(?:Camera|Senato)(?=Votazione|\b)/i.test(text) &&
          completeDate.test(text) && resultMarker.test(text) &&
          finalMarker.test(text)) {
        cardText = text;
        break;
      }
    }
    if (!cardText) return;

    const chamber = cardText.match(/^(Camera|Senato)(?=Votazione|\b)/i);
    const date = cardText.match(completeDate);
    const result = cardText.match(resultMarker);
    if (!chamber || !date || !result) return;

    const day = date[1].padStart(2, '0');
    const month = date[2].padStart(2, '0');
    const year = date[3];
    const iso = year + '-' + month + '-' + day;
    if (!Number.isFinite(Date.parse(iso + 'T12:00:00Z'))) return;

    const afterDate = cardText.slice(date.index + date[0].length);
    const label = afterDate.search(/votazione\s+finale(?:\s+segreto)?\s*(?:Approvata|Respinta)/i);
    let title = (label >= 0 ? afterDate.slice(0, label) : afterDate)
      .replace(/(?:VOTO FINALE|Votazione finale)\s*[-–]?\s*$/i, '')
      .replace(/[-–\s]+$/g, '')
      .trim();

    // Avoid inventing a bill or law from a generic Openpolis label.
    if (!title) title = 'Votazione finale ' + id;
    seen.add(id);
    items.push({
      openpolis_id: id,
      camera: chamber[1].toLowerCase() === 'camera' ? 'Camera' : 'Senato',
      titolo: title.slice(0, 500),
      url_dettaglio: OPENPOLIS_BASE + '/votazioni/' + id,
      esito: result[1].toLowerCase() === 'approvata' ? 'Approvata' : 'Respinta',
      data_votazione: iso
    });
  });

  return items;
}

/**
 * Retrieve recent final votes, preserving the source's classification.
 * The upstream may return fewer than page_size cards on a page.
 * An empty first page is a parser/upstream failure, not proof of no votes.
 */
async function fetchVotazioniFinaliDecisive(maxItems = 30) {
  const maxCount = Math.min(100, Math.max(1, Number(maxItems) || 30));
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= 10 && all.length < maxCount; page++) {
    const html = await fetchListaVotazioniFinali(page);
    const items = parseListaVotazioniFinali(html);
    if (page === 1 && items.length === 0) {
      throw new Error('OPENPOLIS_FINAL_VOTES_PARSE_EMPTY');
    }
    if (items.length === 0) break;
    let added = 0;
    for (const it of items) {
      if (seen.has(it.openpolis_id)) continue;
      seen.add(it.openpolis_id);
      all.push(it);
      added++;
      if (all.length >= maxCount) break;
    }
    // Avoid loops if upstream ignores "page" and repeats page 1.
    if (!added) break;
  }
  return all.slice(0, maxCount);
}

/**
 * Salva in DB (tabella openpolis_votazioni_finali_decisive). Upsert per openpolis_id.
 */
async function saveToDb(items, pool) {
  if (!pool || !items.length) return 0;
  const client = await pool.connect();
  let saved = 0;
  try {
    for (const row of items) {
      await client.query(
        `INSERT INTO openpolis_votazioni_finali_decisive
         (openpolis_id, camera, titolo, url_dettaglio, esito, data_votazione, data_scraping, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (openpolis_id) DO UPDATE SET
           camera = EXCLUDED.camera,
           titolo = EXCLUDED.titolo,
           url_dettaglio = EXCLUDED.url_dettaglio,
           esito = EXCLUDED.esito,
           data_votazione = EXCLUDED.data_votazione,
           data_scraping = EXCLUDED.data_scraping,
           updated_at = EXCLUDED.updated_at`,
        [
          row.openpolis_id,
          row.camera,
          row.titolo,
          row.url_dettaglio,
          row.esito,
          row.data_votazione || null
        ]
      );
      saved++;
    }
  } finally {
    client.release();
  }
  return saved;
}

/**
 * Legge dal DB le ultime votazioni finali decisive (ordinate per data_votazione desc).
 * @param {object} pool
 * @param {number} limit - default 20
 */
async function loadFromDb(pool, limit = 20) {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `SELECT id, openpolis_id, camera, titolo, url_dettaglio, esito, data_votazione, data_scraping
       FROM openpolis_votazioni_finali_decisive
       ORDER BY data_votazione DESC NULLS LAST, data_scraping DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  } catch (err) {
    if (err.code !== '42P01') console.warn('[openpolisVotazioniFinali] loadFromDb:', err.message);
    return [];
  }
}

module.exports = {
  fetchListaVotazioniFinali,
  parseListaVotazioniFinali,
  fetchVotazioniFinaliDecisive,
  saveToDb,
  loadFromDb,
  OPENPOLIS_BASE,
  LISTA_VOTI_FINALI
};
