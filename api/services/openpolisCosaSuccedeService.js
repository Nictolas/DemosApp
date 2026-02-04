/**
 * Servizio per recuperare gli ultimi DDL approvati (Camera e Senato)
 * dalla sezione "Cosa succede" di parlamento19.openpolis.it
 */

const axios = require('axios');
const cheerio = require('cheerio');

const OPENPOLIS_BASE = 'https://parlamento19.openpolis.it';

const FETCH_OPTS = {
  headers: {
    'Accept': 'text/html',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  timeout: 15000,
  validateStatus: (s) => s < 500
};

/**
 * Fetch della homepage Openpolis (sezione Cosa succede)
 */
async function fetchHomepage() {
  const { data } = await axios.get(OPENPOLIS_BASE, FETCH_OPTS);
  return data;
}

/**
 * Fetch della stessa pagina con filtro "Mostra solo eventi prioritari" attivo.
 * Con questo filtro la lista può includere eventi (es. approvazioni Senato) che
 * nella vista default compaiono solo dopo "Visualizza altri".
 * Prova più nomi parametro usati da Openpolis per il checkbox.
 */
async function fetchHomepageEventiPrioritari() {
  const params = ['prioritari=1', 'solo_prioritari=1', 'only_priority=1'];
  for (const q of params) {
    try {
      const { data } = await axios.get(`${OPENPOLIS_BASE}/?${q}`, FETCH_OPTS);
      if (data && data.includes('disegni_di_legge') && data.includes('è stato approvato')) {
        return data;
      }
    } catch (_) { /* skip */ }
  }
  return '';
}

/**
 * Fetch della homepage Openpolis con browser headless (Puppeteer).
 * Carica la pagina, clicca "Visualizza altri" per espandere l'elenco, poi restituisce l'HTML.
 * Usato come fallback per ottenere eventi Senato che nel primo chunk HTTP non compaiono.
 * Ritorna '' se Puppeteer non è disponibile o in caso di errore.
 */
async function fetchHomepageWithBrowser() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (_) {
    return '';
  }
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(OPENPOLIS_BASE, { waitUntil: 'networkidle2', timeout: 20000 });

    // Attendi che la sezione eventi sia presente
    await page.waitForSelector('a[href*="/attivita_legislativa/disegni_di_legge/"]', { timeout: 10000 }).catch(() => {});

    // Clicca "Visualizza altri" se presente (carica altri eventi, es. Senato)
    const clicked = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('a, button')).find(
        (e) => (e.textContent || '').trim() === 'Visualizza altri'
      );
      if (el) { el.click(); return true; }
      return false;
    });
    if (clicked) await new Promise((r) => setTimeout(r, 2500));

    const html = await page.content();
    await browser.close();
    return html || '';
  } catch (err) {
    if (browser) try { await browser.close(); } catch (_) {}
    console.warn('[openpolisCosaSuccede] fetchHomepageWithBrowser:', err.message);
    return '';
  }
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

    // Contesto: preferire il singolo <li> per non mescolare eventi diversi (es. "presentato" vs "approvato")
    let $block = $a.closest('li').first();
    if ($block.length === 0) $block = $a.closest('div[class*="event"], article, .card, [class*="timeline"]').first();
    if ($block.length === 0) $block = $a.parent();
    const blockText = $block.length ? $block.text() : $a.parent().text();

    // Solo "Il disegno di legge X è stato approvato" (o "è stata approvata la legge").
    // Escludere "Il governo X ha presentato il disegno di legge" (presentazione, non approvazione).
    const hasApprovato = /(?:è\s+stato\s+approvato|è\s+stata\s+approvata\s+(?:la\s+legge|il\s+disegno))/i.test(blockText);
    const hasPresentato = /(?:ha\s+presentato|presentato)\s+(?:il\s+)?disegno\s+di\s+legge/i.test(blockText);
    const hasGovernoPresentato = /\bil\s+governo\b.*?(?:ha\s+presentato|presentato).*?disegno\s+di\s+legge/is.test(blockText);
    if (!hasApprovato || hasPresentato || hasGovernoPresentato) return;

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

    // Data: dall'intestazione di sezione (h3/h4) che precede questo evento nel DOM (es. "28 gennaio 2026")
    // Non usare il primo h3 della pagina (es. "3 febbraio") altrimenti tutti gli eventi prendono quella data.
    const datePattern = /(\d{1,2})\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s*(\d{4})/i;
    let dateStr = null;
    let $container = $block.parent();
    while ($container.length && !dateStr) {
      const $prev = $container.prevAll('h3, h4').first();
      if ($prev.length) {
        const t = $prev.text().replace(/\s+/g, ' ').trim();
        const dataMatch = t.match(datePattern);
        if (dataMatch) dateStr = `${dataMatch[3]}-${meseToNum(dataMatch[2])}-${dataMatch[1].padStart(2, '0')}`;
      }
      $container = $container.parent();
    }
    if (!dateStr) {
      $block.parent().find('h3, h4, .date, [class*="date"]').each((__, h) => {
        const t = $(h).text().replace(/\s+/g, ' ').trim();
        const dataMatch = t.match(datePattern);
        if (dataMatch) dateStr = `${dataMatch[3]}-${meseToNum(dataMatch[2])}-${dataMatch[1].padStart(2, '0')}`;
        return false;
      });
    }
    if (!dateStr && $('h3').length) {
      const rootDates = $('h3').filter((_, h) => $(h).text().match(datePattern));
      if (rootDates.length) {
        const t = $(rootDates[0]).text();
        const dataMatch = t.replace(/\s+/g, ' ').match(datePattern);
        if (dataMatch) dateStr = `${dataMatch[3]}-${meseToNum(dataMatch[2])}-${dataMatch[1].padStart(2, '0')}`;
      }
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
 * Unisce due liste di eventi per URL (niente duplicati), mantenendo l'ordine cronologico.
 */
function mergeEvents(eventsA, eventsB) {
  const seen = new Set();
  const out = [];
  for (const e of eventsA) {
    const key = e.url || e.titolo;
    if (!seen.has(key)) { seen.add(key); out.push(e); }
  }
  for (const e of eventsB) {
    const key = e.url || e.titolo;
    if (!seen.has(key)) { seen.add(key); out.push(e); }
  }
  return out;
}

/**
 * Esegue lo scraping completo: homepage + vista "eventi prioritari" -> merge -> ultimi DDL Camera/Senato -> dettagli.
 * La vista con "eventi prioritari" può includere approvazioni Senato che nella default compaiono dopo "Visualizza altri".
 * Ritorna { camera: { titolo, url_dettaglio, codice_ddl, data_approvazione }, senato: { ... } }.
 */
async function fetchUltimiDdlApprovati() {
  const [html, htmlPrioritari] = await Promise.all([
    fetchHomepage(),
    fetchHomepageEventiPrioritari().catch(() => '')
  ]);
  const eventsDefault = parseCosaSuccede(html);
  const eventsPrioritari = htmlPrioritari ? parseCosaSuccede(htmlPrioritari) : [];
  let events = mergeEvents(eventsDefault, eventsPrioritari);
  let { camera: evCamera, senato: evSenato } = findUltimiDdl(events);
  // Se dopo il merge manca il Senato, usa il primo "approvato" Senato da una delle due viste
  if (!evSenato) {
    const fromPrioritari = (eventsPrioritari || []).filter((e) => e.ramo === 'Senato');
    const fromDefault = (eventsDefault || []).filter((e) => e.ramo === 'Senato');
    const firstSenato = fromPrioritari[0] || fromDefault[0];
    if (firstSenato) evSenato = firstSenato;
  }
  // Fallback headless: se ancora manca il Senato, carichiamo la pagina con Puppeteer e "Visualizza altri"
  if (!evSenato) {
    const htmlBrowser = await fetchHomepageWithBrowser();
    if (htmlBrowser) {
      const eventsBrowser = parseCosaSuccede(htmlBrowser);
      const firstSenatoBrowser = (eventsBrowser || []).filter((e) => e.ramo === 'Senato')[0];
      if (firstSenatoBrowser) evSenato = firstSenatoBrowser;
    }
  }
  if (!evCamera && (eventsDefault || []).length > 0) {
    const firstCamera = (eventsDefault || []).find((e) => e.ramo === 'Camera');
    if (firstCamera) evCamera = firstCamera;
  }

  const result = { camera: null, senato: null };

  if (evCamera) {
    const dettaglio = await fetchDettaglioDdl(evCamera.url);
    result.camera = {
      titolo: dettaglio?.titolo || evCamera.titolo,
      url_dettaglio: evCamera.url,
      codice_ddl: dettaglio?.codice_ddl || evCamera.codice_ddl,
      data_approvazione: evCamera.dateStr || dettaglio?.data_approvazione
    };
  }

  if (evSenato) {
    const dettaglio = await fetchDettaglioDdl(evSenato.url);
    result.senato = {
      titolo: dettaglio?.titolo || evSenato.titolo,
      url_dettaglio: evSenato.url,
      codice_ddl: dettaglio?.codice_ddl || evSenato.codice_ddl,
      data_approvazione: evSenato.dateStr || dettaglio?.data_approvazione
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
    // Aggiorna solo quando abbiamo dati; non cancellare se la sync non trova nulla (es. senza Puppeteer in prod)
    // così l'ultima votazione Senato/Camera salvata resta visibile finché non ne scrapiamo una nuova.
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
  fetchHomepageEventiPrioritari,
  fetchHomepageWithBrowser,
  parseCosaSuccede,
  findUltimiDdl,
  fetchDettaglioDdl,
  fetchUltimiDdlApprovati,
  saveToDb,
  loadFromDb,
  OPENPOLIS_BASE
};
