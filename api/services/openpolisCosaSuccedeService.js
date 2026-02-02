/**
 * Servizio per recuperare gli ultimi DDL approvati (Camera e Senato)
 * dalla sezione "Cosa succede" di parlamento19.openpolis.it
 */

const axios = require('axios');
const cheerio = require('cheerio');

const OPENPOLIS_BASE = 'https://parlamento19.openpolis.it';

/**
 * Fetch della homepage Openpolis (sezione Cosa succede)
 */
async function fetchHomepage() {
  const { data } = await axios.get(OPENPOLIS_BASE, {
    headers: {
      'Accept': 'text/html',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 15000,
    validateStatus: (s) => s < 500
  });
  return data;
}

/**
 * Dalla homepage estrae gli eventi "disegno di legge ... è stato approvato" / "Èstata approvata la legge"
 * con link a disegni_di_legge e ramo (Camera/Senato).
 * Ritorna array { titolo, url, codice_ddl, ramo, dateStr } in ordine cronologico (primo = più recente).
 */
function parseCosaSuccede(html) {
  const $ = cheerio.load(html);
  const events = [];
  const seenUrls = new Set();

  // Cerca tutti i link a disegni di legge
  $(`a[href*="/attivita_legislativa/disegni_di_legge/"]`).each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    if (!href || seenUrls.has(href)) return;

    const fullUrl = href.startsWith('http') ? href : OPENPOLIS_BASE + (href.startsWith('/') ? href : '/' + href);
    const match = fullUrl.match(/\/disegni_di_legge\/([A-Z]_[\w\-]+)/i);
    const codice_ddl = match ? match[1].replace(/_/g, '.') : null; // C_2336 -> C.2336
    const titoloLink = $a.text().trim();

    // Contesto: testo del contenitore (li, div, p) che contiene il link
    let $block = $a.closest('li, div[class*="event"], article, .card, [class*="timeline"]').first();
    if ($block.length === 0) $block = $a.parent();
    const blockText = $block.length ? $block.text() : $a.parent().text();

    const isApprovato = /(?:il\s+disegno\s+di\s+legge|è\s+stato\s+approvato|èstata\s+approvata\s+la\s+legge)/i.test(blockText);
    if (!isApprovato) return;

    // Ramo: cerca "Camera" o "Senato" nel blocco o nei fratelli successivi (badge dell'evento)
    let ramo = null;
    const textToSearch = blockText + ' ';
    const idxCamera = textToSearch.search(/\bCamera\b/);
    const idxSenato = textToSearch.search(/\bSenato\b/);
    if (idxCamera !== -1 && idxSenato !== -1) ramo = idxSenato > idxCamera ? 'Senato' : 'Camera';
    else if (idxCamera !== -1) ramo = 'Camera';
    else if (idxSenato !== -1) ramo = 'Senato';
    if (!ramo) {
      $block.nextAll().each((__, next) => {
        const t = $(next).text();
        if (/\bCamera\b/.test(t)) { ramo = ramo || 'Camera'; return false; }
        if (/\bSenato\b/.test(t)) { ramo = ramo || 'Senato'; return false; }
      });
    }
    if (!ramo) return;

    // Data: da intestazione tipo "### 21 gennaio 2026" sopra il blocco
    let dateStr = null;
    $block.parent().find('h3, h4, .date, [class*="date"]').each((__, h) => {
      const t = $(h).text().replace(/\s+/g, ' ').trim();
      const dataMatch = t.match(/(\d{1,2})\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})/i);
      if (dataMatch) dateStr = `${dataMatch[3]}-${meseToNum(dataMatch[2])}-${dataMatch[1].padStart(2, '0')}`;
      return false;
    });
    const rootDates = $('h3').filter((_, h) => $(h).text().match(/\d{1,2}\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*\d{4}/i));
    if (!dateStr && rootDates.length) {
      const t = $(rootDates[0]).text();
      const dataMatch = t.replace(/\s+/g, ' ').match(/(\d{1,2})\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})/i);
      if (dataMatch) dateStr = `${dataMatch[3]}-${meseToNum(dataMatch[2])}-${dataMatch[1].padStart(2, '0')}`;
    }

    seenUrls.add(href);
    events.push({
      titolo: titoloLink || 'Disegno di legge',
      url: fullUrl,
      codice_ddl: codice_ddl || (href.split('/').pop() || '').replace(/_/g, '.'),
      ramo,
      dateStr
    });
  });

  return events;
}

function meseToNum(str) {
  const m = { gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06', luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12' };
  return m[str.toLowerCase()] || '01';
}

/**
 * Dalla lista di eventi prende l'ultimo (primo in ordine) "DDL approvato" per Camera e per Senato.
 */
function findUltimiDdl(events) {
  let camera = null;
  let senato = null;
  for (const e of events) {
    if (e.ramo === 'Camera' && !camera) camera = e;
    if (e.ramo === 'Senato' && !senato) senato = e;
    if (camera && senato) break;
  }
  return { camera, senato };
}

/**
 * Fetch pagina dettaglio DDL per titolo completo e data approvazione.
 */
async function fetchDettaglioDdl(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000,
      validateStatus: (s) => s < 500
    });
    const $ = cheerio.load(data);

    // Su Openpolis: h1 = "Disegno di legge" (generico), il titolo vero è in h2/h3 sotto (es. "Disciplina dell'attività...")
    const skipPatterns = [
      /^Disegno\s+di\s+legge$/i,
      /^Decreto\s+legge$/i,
      /Natura:\s*Legge/i,
      /Tipo\s+di\s+iniziativa/i,
      /^Camera$|^Senato$/i,
      /^C\.\d+$|^S\.\d+$/,
      /Legge\s+ordinaria/i
    ];
    let titolo = null;
    $('h1, h2, h3').each((_, el) => {
      const t = $(el).text().trim();
      if (!t || t.length < 15) return true; // titolo specifico è lungo
      if (skipPatterns.some(p => p.test(t))) return true;
      if (/^[CS]\.\d+/.test(t) || t.includes('|')) return true; // riga con codice o metadata
      titolo = t;
      return false; // stop al primo titolo valido
    });
    if (!titolo) titolo = $('title').text().split(' - ')[0].trim() || 'Disegno di legge';

    let dataApprovazione = null;
    const bodyText = $('body').text();
    const dateMatch = bodyText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch) {
      const [, d, m, y] = dateMatch;
      dataApprovazione = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const codiceMatch = url.match(/disegni_di_legge\/([A-Z]_[\w\-]+)/i);
    const codice_ddl = codiceMatch ? codiceMatch[1].replace(/_/g, '.') : null;

    return { titolo: titolo.trim(), data_approvazione: dataApprovazione, codice_ddl };
  } catch (err) {
    console.warn(`[openpolisCosaSuccede] Errore fetch dettaglio ${url}:`, err.message);
    return null;
  }
}

/**
 * Esegue lo scraping completo: homepage -> ultimi DDL Camera/Senato -> dettagli.
 * Ritorna { camera: { titolo, url_dettaglio, codice_ddl, data_approvazione }, senato: { ... } }.
 */
async function fetchUltimiDdlApprovati() {
  const html = await fetchHomepage();
  const events = parseCosaSuccede(html);
  const { camera: evCamera, senato: evSenato } = findUltimiDdl(events);

  const result = { camera: null, senato: null };

  if (evCamera) {
    const dettaglio = await fetchDettaglioDdl(evCamera.url);
    result.camera = {
      titolo: dettaglio?.titolo || evCamera.titolo,
      url_dettaglio: evCamera.url,
      codice_ddl: dettaglio?.codice_ddl || evCamera.codice_ddl,
      data_approvazione: dettaglio?.data_approvazione || evCamera.dateStr
    };
  }

  if (evSenato) {
    const dettaglio = await fetchDettaglioDdl(evSenato.url);
    result.senato = {
      titolo: dettaglio?.titolo || evSenato.titolo,
      url_dettaglio: evSenato.url,
      codice_ddl: dettaglio?.codice_ddl || evSenato.codice_ddl,
      data_approvazione: dettaglio?.data_approvazione || evSenato.dateStr
    };
  }

  return result;
}

/**
 * Salva in DB (tabella openpolis_ultimi_ddl_approvati). Opzionale: pool passato dall'esterno.
 */
async function saveToDb(result, pool) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    for (const [key, row] of Object.entries(result)) {
      if (!row || !row.titolo || !row.url_dettaglio) continue;
      const camera = key === 'camera' ? 'Camera' : key === 'senato' ? 'Senato' : null;
      if (!camera) continue;
      await client.query(
        `INSERT INTO openpolis_ultimi_ddl_approvati (camera, titolo, codice_ddl, url_dettaglio, data_approvazione, data_scraping, updated_at)
         VALUES ($1, $2, $3, $4, $5::date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (camera) DO UPDATE SET
           titolo = EXCLUDED.titolo,
           codice_ddl = EXCLUDED.codice_ddl,
           url_dettaglio = EXCLUDED.url_dettaglio,
           data_approvazione = EXCLUDED.data_approvazione,
           data_scraping = EXCLUDED.data_scraping,
           updated_at = EXCLUDED.updated_at`,
        [camera, row.titolo, row.codice_ddl || '', row.url_dettaglio, row.data_approvazione || null]
      );
    }
  } finally {
    client.release();
  }
}

/**
 * Legge dal DB gli ultimi DDL (se presenti). Ritorna { camera: { titolo, url_dettaglio, ... }, senato: { ... } }.
 */
async function loadFromDb(pool) {
  if (!pool) return { camera: null, senato: null };
  try {
    const { rows } = await pool.query(
      `SELECT camera, titolo, codice_ddl, url_dettaglio, data_approvazione, data_scraping
       FROM openpolis_ultimi_ddl_approvati`
    );
    const out = { camera: null, senato: null };
    for (const r of rows) {
      out[r.camera.toLowerCase() === 'camera' ? 'camera' : 'senato'] = {
        titolo: r.titolo,
        codice_ddl: r.codice_ddl,
        url_dettaglio: r.url_dettaglio,
        data_approvazione: r.data_approvazione,
        data_scraping: r.data_scraping
      };
    }
    return out;
  } catch (err) {
    if (err.code !== '42P01') console.warn('[openpolisCosaSuccede] loadFromDb:', err.message);
    return { camera: null, senato: null };
  }
}

module.exports = {
  fetchHomepage,
  parseCosaSuccede,
  findUltimiDdl,
  fetchDettaglioDdl,
  fetchUltimiDdlApprovati,
  saveToDb,
  loadFromDb,
  OPENPOLIS_BASE
};
