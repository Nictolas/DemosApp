'use strict';

// Feed pubblico, disabilitato finché endpoint e diritti di riuso non sono verificati.
// Mai interrogare Chrono per singolo utente, né scrivere i dati importati in Supabase.
const crypto = require('node:crypto');
const fetch = require('node-fetch');
const { regionAliases } = require('./politicalEligibilityService');

const SOURCE = 'Chrono Collective';
const BASE = 'https://mobilitazioni.chronocol.com/';
const REFRESH_MS = 12 * 60 * 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 3000;
const MAX_BYTES = 2 * 1024 * 1024;

let cached = [];
let lastSuccess = 0;
let nextAttempt = 0;
let pending = null;

const clean = (value, max = 180) => value == null ? '' : String(value).trim().slice(0, max);
const normalize = (value) => clean(value).toLocaleLowerCase('it-IT').replace(/\s+/g, ' ');

function italianDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric'
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

function italianTime(date) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(date);
}

function dateParts(value) {
  const str = clean(value, 70);
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return { day: str, time: '' };
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?$/.test(str)) {
    return { day: str.slice(0, 10), time: str.slice(11, 16) };
  }
  const date = new Date(str);
  if (!Number.isFinite(date.getTime())) return null;
  return { day: italianDay(date), time: italianTime(date) };
}

function sourceUrl(value) {
  if (!value) return BASE;
  try {
    const url = new URL(value, BASE);
    if (url.protocol !== 'https:' ||
        !['mobilitazioni.chronocol.com', 'chronocol.com'].includes(url.hostname) ||
        url.username || url.password) return BASE;
    return url.href;
  } catch {
    return BASE;
  }
}

function mapEvent(record) {
  if (!record || typeof record !== 'object') return null;
  const row = record.properties && typeof record.properties === 'object' ? record.properties : record;
  const name = clean(row.title ?? row.name ?? row.nome ?? row.nome_evento, 200);
  const start = dateParts(row.start_at ?? row.starts_at ?? row.startsAt ??
    row.start_date ?? row.startDate ?? row.giorno_inizio ?? row.date ?? row.start);
  if (!name || !start || !Number.isFinite(Date.parse(start.day + 'T12:00:00Z'))) return null;

  const end = dateParts(row.end_at ?? row.ends_at ?? row.endsAt ??
    row.end_date ?? row.endDate ?? row.giorno_fine ?? row.end);
  const city = clean(row.city ?? row.comune ?? row.comune_evento, 100);
  const province = clean(row.province ?? row.provincia ?? row.provincia_evento, 100);
  const region = clean(row.region ?? row.regione ?? row.regione_evento, 100);
  const rawKey = clean(row.id ?? record.id ?? row.slug ?? row.url ?? row.link ??
    [name, start.day, city].join('|'), 350);
  const id = 'chronocol:' + crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 24);
  const startTime = clean(row.orario_inizio ?? row.time ?? start.time, 8);
  const endTime = clean(row.orario_fine ?? end?.time, 8);

  return {
    id,
    nome_evento: name,
    tipologia_evento: clean(row.type ?? row.category ?? row.tipo ?? row.tipologia_evento, 60) || 'Mobilitazione',
    paese_evento: 'Italia',
    regione_evento: region,
    provincia_evento: province,
    comune_evento: city,
    indirizzo_evento: clean(row.address ?? row.indirizzo ?? row.indirizzo_evento ?? row.location, 200),
    giorno_inizio: start.day,
    giorno_fine: end?.day || null,
    orario_inizio: /^\d{2}:\d{2}/.test(startTime) ? startTime.slice(0, 5) : null,
    orario_fine: /^\d{2}:\d{2}/.test(endTime) ? endTime.slice(0, 5) : null,
    organizzatore: clean(row.organizer ?? row.organizzatore, 120) || SOURCE,
    descrizione: clean(row.description ?? row.descrizione, 1000),
    fonte: SOURCE,
    fonte_url: sourceUrl(row.url ?? row.link ?? row.source_url),
    external_import: true
  };
}

function normalizePayload(payload) {
  const rows = Array.isArray(payload) ? payload :
    (payload?.events ?? payload?.items ?? payload?.features ?? payload?.data?.events ?? payload?.data);
  if (!Array.isArray(rows)) throw new Error('Formato feed non supportato');
  if (rows.length > MAX_EVENTS) throw new Error('Feed oltre il limite di eventi');
  const seen = new Set();
  return rows.map(mapEvent).filter((event) => {
    if (!event || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function notExpired(event, now = new Date()) {
  const today = italianDay(now);
  const lastDay = event.giorno_fine || event.giorno_inizio;
  if (lastDay < today) return false;
  if (lastDay > today) return true;
  if (!event.orario_fine) return true;
  return event.orario_fine > italianTime(now);
}

function approvedFeedUrl(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== 'mobilitazioni.chronocol.com' ||
        url.username || url.password || url.port) return null;
    return url.href;
  } catch { return null; }
}

async function retrieve(fetchImpl = fetch, now = new Date()) {
  if (process.env.CHRONOCOL_IMPORT_ENABLED !== 'true') return [];
  const url = approvedFeedUrl(process.env.CHRONOCOL_EVENTS_JSON_URL);
  if (!url) return [];
  const time = now.getTime();
  if (pending) return pending;
  if (time < nextAttempt) return lastSuccess && time - lastSuccess < MAX_STALE_MS
    ? cached.filter((item) => notExpired(item, now)) : [];
  nextAttempt = time + REFRESH_MS;
  pending = (async () => {
    try {
      const response = await fetchImpl(url, {
        timeout: 8000, size: MAX_BYTES, redirect: 'error',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const body = await response.json();
      cached = normalizePayload(body);
      lastSuccess = time;
    } catch {
      // Non propagare al feed DEMOS errori o dati da un servizio esterno.
      console.warn('[chronocol] Importazione non disponibile: mantenuto ultimo snapshot valido');
    } finally {
      pending = null;
    }
    return lastSuccess && time - lastSuccess < MAX_STALE_MS
      ? cached.filter((item) => notExpired(item, now)) : [];
  })();
  return pending;
}

function signature(event) {
  const city = normalize(event.comune_evento);
  if (!city) return '';
  const rawDay = event.giorno_inizio;
  const day = rawDay instanceof Date ? rawDay.toISOString().slice(0, 10) :
    clean(rawDay, 30).slice(0, 10);
  return [normalize(event.nome_evento), day, city].join('|');
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
  });
  if (!global) return [...nativeEvents, ...additions];
  return [...nativeEvents, ...additions].sort((a, b) =>
    clean(a.giorno_inizio).localeCompare(clean(b.giorno_inizio)));
}

module.exports = {
  approvedFeedUrl, mapEvent, normalizePayload, notExpired,
  retrieve, visibleInTerritory, mergeEvents
};
