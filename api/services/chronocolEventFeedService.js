'use strict';

// Importatore OPZIONALE e in sola lettura: non scrive eventi in Supabase.
// Chrono pubblica come open data i dati fattuali degli eventi citandone la fonte.
// Il servizio interroga unicamente i campi pubblici necessari, mai CONTATTI.
const crypto = require('node:crypto');
const fetch = require('node-fetch');
const { regionAliases } = require('./politicalEligibilityService');

const SOURCE = 'Chrono Collective';
const BASE = 'https://mobilitazioni.chronocol.com/';
const API = new URL('/api/w-mobs', BASE);
const FIELDS = Object.freeze([
  'TIPO', 'CITTA', 'DATA_ORARIO', 'DATA_FINE', 'FINE_EFFETTIVA',
  'INDIRIZZO', 'RITROVO_LUOGO', 'VERIFICATA', 'ANNULLATA', 'LATITUDE',
  'LONGITUDE', 'SCIOPERO', 'PIATTAFORMA'
]);
const PAGE_SIZE = 100;
const MAX_EVENTS = 3000;
const MAX_PAGES = Math.ceil(MAX_EVENTS / PAGE_SIZE);
const REFRESH_MS = 12 * 60 * 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;
const MAX_BYTES_PER_PAGE = 2 * 1024 * 1024;

let cache = [];
let lastSuccess = 0;
let nextAttempt = 0;
let pending = null;

const clean = (value, max = 180) => value == null ? '' : String(value).trim().slice(0, max);
const normalize = (value) => clean(value).toLocaleLowerCase('it-IT').replace(/\s+/g, ' ');

function italianDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function italianTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(date);
}

function dateParts(value) {
  if (!value) return null;
  const raw = clean(value, 80);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { day: raw, time: '' };
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return { day: italianDay(date), time: italianTime(date) };
}

function buildPageUrl(page = 1) {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGES) throw new Error('Invalid Chrono page');
  const url = new URL(API);
  FIELDS.forEach((field, index) => url.searchParams.set('fields[' + index + ']', field));
  url.searchParams.set('pagination[page]', String(page));
  url.searchParams.set('pagination[pageSize]', String(PAGE_SIZE));
  url.searchParams.set('filters[VERIFICATA][$eq]', 'true');
  url.searchParams.set('filters[ANNULLATA][$eq]', 'false');
  url.searchParams.set('sort[0]', 'DATA_ORARIO:asc');
  return url.href;
}

function mapEvent(record) {
  if (!record || typeof record !== 'object') return null;
  // Strapi v5: i soli eventi verificati dalla redazione sono pubblicabili.
  if (record.VERIFICATA !== true || record.ANNULLATA === true) return null;
  const city = clean(record.CITTA, 100);
  const type = clean(record.TIPO, 60);
  const start = dateParts(record.DATA_ORARIO);
  if (!city || !type || !start) return null;
  const end = dateParts(record.FINE_EFFETTIVA || record.DATA_FINE);
  const rawId = clean(record.documentId || record.id, 140);
  if (!rawId) return null;
  const id = 'chronocol:' + crypto.createHash('sha256').update(rawId).digest('hex').slice(0, 24);
  const slug = encodeURIComponent(rawId);
  // Titolo composto solo da dati fattuali presenti nell'export open data.
  return {
    id,
    nome_evento: type + ' a ' + city,
    tipologia_evento: 'Mobilitazione',
    categoria_mobilitazione: type,
    paese_evento: null,
    regione_evento: null,
    provincia_evento: null,
    comune_evento: city,
    indirizzo_evento: clean(record.INDIRIZZO || record.RITROVO_LUOGO, 200) || null,
    giorno_inizio: start.day,
    giorno_fine: end?.day || null,
    orario_inizio: start.time || null,
    orario_fine: end?.time || null,
    sciopero: record.SCIOPERO === true,
    latitude: Number.isFinite(record.LATITUDE) ? record.LATITUDE : null,
    longitude: Number.isFinite(record.LONGITUDE) ? record.LONGITUDE : null,
    fonte: SOURCE,
    fonte_url: BASE + 'e/' + slug,
    external_import: true
  };
}

function normalizePayload(payload) {
  const rows = payload?.data;
  if (!Array.isArray(rows) || !payload?.meta?.pagination) {
    throw new Error('Unexpected Chrono API format');
  }
  if (rows.length > PAGE_SIZE) throw new Error('Unexpected Chrono page length');
  return rows.map(mapEvent).filter(Boolean);
}

function notExpired(event, now = new Date()) {
  const today = italianDay(now);
  const lastDay = event.giorno_fine || event.giorno_inizio;
  if (!lastDay || lastDay < today) return false;
  if (lastDay > today) return true;
  if (!event.orario_fine) return true; // senza fine nota: fino a mezzanotte italiana
  return event.orario_fine > italianTime(now);
}

async function loadAllPages(fetchImpl) {
  const all = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const response = await fetchImpl(buildPageUrl(page), {
      timeout: 8000,
      size: MAX_BYTES_PER_PAGE,
      redirect: 'error',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Chrono HTTP ' + response.status);
    const body = await response.json();
    const incoming = normalizePayload(body);
    const pagination = body.meta.pagination;
    if (!Number.isInteger(pagination.pageCount) || pagination.pageCount < 1 ||
        pagination.pageCount > MAX_PAGES ||
        (Number.isInteger(pagination.page) && pagination.page !== page)) {
      throw new Error('Unexpected Chrono pagination');
    }
    pages = pagination.pageCount;
    all.push(...incoming);
    if (all.length > MAX_EVENTS) throw new Error('Too many Chrono events');
    page++;
  }
  return [...new Map(all.map((event) => [event.id, event])).values()];
}

async function retrieve(fetchImpl = fetch, now = new Date()) {
  if (process.env.CHRONOCOL_IMPORT_ENABLED !== 'true') return [];
  const ms = now.getTime();
  if (pending) return pending;
  if (ms < nextAttempt) {
    return lastSuccess && ms - lastSuccess < MAX_STALE_MS
      ? cache.filter((event) => notExpired(event, now)) : [];
  }
  nextAttempt = ms + REFRESH_MS;
  pending = (async () => {
    try {
      const all = await loadAllPages(fetchImpl);
      cache = all;
      lastSuccess = ms;
    } catch (error) {
      console.warn('[chronocol] Sorgente temporaneamente indisponibile:', error?.message);
    } finally {
      pending = null;
    }
    return lastSuccess && ms - lastSuccess < MAX_STALE_MS
      ? cache.filter((event) => notExpired(event, now)) : [];
  })();
  return pending;
}

function eventDateKey(event) {
  const raw = event.giorno_inizio;
  const day = raw instanceof Date ? raw.toISOString().slice(0, 10) : clean(raw, 30).slice(0, 10);
  return day + 'T' + (clean(event.orario_inizio, 8) || '00:00');
}

function signature(event) {
  const city = normalize(event.comune_evento);
  if (!city) return '';
  return [normalize(event.nome_evento), eventDateKey(event).slice(0, 10), city].join('|');
}

function visibleInTerritory(event, user) {
  if (!user) return false;
  if (event.comune_evento && normalize(event.comune_evento) === normalize(user.comune_residenza)) return true;
  if (event.provincia_evento && normalize(event.provincia_evento) === normalize(user.provincia_residenza)) return true;
  if (event.regione_evento) {
    return regionAliases(user.regione_residenza).includes(normalize(event.regione_evento)) ||
      normalize(event.regione_evento) === normalize(user.regione_residenza);
  }
  return false;
}

function mergeEvents(nativeEvents, importedEvents, { user = null, global = false, now = new Date() } = {}) {
  const existing = new Set(nativeEvents.map(signature).filter(Boolean));
  const additions = importedEvents.filter((event) => {
    if (!notExpired(event, now) || (!global && !visibleInTerritory(event, user))) return false;
    const key = signature(event);
    if (key && existing.has(key)) return false;
    if (key) existing.add(key);
    return true;
  }).map((event) => global ? event : { ...event, feed_priority: 1, feed_reason: 'TERRITORY' });
  return [...nativeEvents, ...additions].sort((a, b) => {
    if (!global) {
      const priorityDiff = (a.feed_priority ?? 99) - (b.feed_priority ?? 99);
      if (priorityDiff) return priorityDiff;
    }
    return eventDateKey(a).localeCompare(eventDateKey(b)) ||
      String(a.id).localeCompare(String(b.id));
  });
}

module.exports = {
  SOURCE, FIELDS, buildPageUrl, mapEvent, normalizePayload, notExpired,
  loadAllPages, retrieve, visibleInTerritory, mergeEvents
};
