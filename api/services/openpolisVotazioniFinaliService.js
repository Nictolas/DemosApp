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
  const url = page <= 1 ? `${LISTA_VOTI_FINALI}&page=1` : `${LISTA_VOTI_FINALI}&page=${page}`;
  const { data } = await axios.get(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 15000,
    validateStatus: (s) => s < 500
  });
  return data;
}

/**
 * Dalla lista HTML estrae le votazioni (titolo, link, camera, esito, data).
 * Filtra solo Approvata/Respinta (decisive).
 */
function parseListaVotazioniFinali(html) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  // Link alle pagine dettaglio: /votazioni/vs19_xxx o /votazioni/19-xxx-x
  $('a[href*="/votazioni/"]').each((_, el) => {
    const $a = $(el);
    const href = ($a.attr('href') || '').trim();
    const match = href.match(/\/votazioni\/(vs19_[\w-]+|19-\d+-\d+)/);
    if (!match || href.includes('#')) return;
    const openpolisId = match[1];
    if (seen.has(openpolisId)) return;
    seen.add(openpolisId);

    const linkText = $a.text().replace(/\s+/g, ' ').trim();
    const camera = /^Camera/i.test(linkText) ? 'Camera' : /^Senato/i.test(linkText) ? 'Senato' : null;
    if (!camera) return;

    const esitoMatch = linkText.match(/\b(Approvata|Respinta)\b/);
    const esito = esitoMatch ? esitoMatch[1] : null;
    if (!esito) return;

    const dateMatch = linkText.match(/Seduta\s+n\.\s*\d+\s+del\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    let dataVotazione = null;
    if (dateMatch) {
      const [, d, m, y] = dateMatch;
      dataVotazione = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const fullUrl = href.startsWith('http') ? href : OPENPOLIS_BASE + (href.startsWith('/') ? href : '/' + href);

    let titolo = '';
    const $container = $a.closest('div, article, li');
    if ($container.length) titolo = $container.find('h3').first().text().trim();
    if (!titolo) titolo = $a.prevAll('h3').first().text().trim();
    if (!titolo) titolo = $a.parent().prevAll('h3').first().text().trim();
    if (!titolo) titolo = `Votazione ${openpolisId}`;

    items.push({
      openpolis_id: openpolisId,
      camera,
      titolo: titolo.substring(0, 500),
      url_dettaglio: fullUrl,
      esito,
      data_votazione: dataVotazione
    });
  });

  return items;
}

/**
 * Recupera le ultime N votazioni finali decisive (lista + opzionale dettaglio).
 * @param {number} maxItems - numero massimo da tenere (default 30)
 * @returns {Promise<Array>} array di { openpolis_id, camera, titolo, url_dettaglio, esito, data_votazione }
 */
async function fetchVotazioniFinaliDecisive(maxItems = 30) {
  const all = [];
  let page = 1;
  const maxPages = 3;

  while (page <= maxPages) {
    const html = await fetchListaVotazioniFinali(page);
    const items = parseListaVotazioniFinali(html);
    if (items.length === 0) break;
    for (const it of items) {
      if (all.length >= maxItems) break;
      all.push(it);
    }
    if (items.length < 50) break;
    page++;
  }

  return all.slice(0, maxItems);
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
