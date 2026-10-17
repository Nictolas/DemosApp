'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const SOURCE_ID = 'it.official_gazette';
const PROCESS_TYPE_ID = 'it.referendum_signature_request';
const JURISDICTION_ID = 'it';
const BASE_URL = 'https://www.gazzettaufficiale.it';
const DEFAULT_BOOTSTRAP_LOOKBACK_DAYS = 120;
const DEFAULT_INCREMENTAL_OVERLAP_DAYS = 3;
const DEFAULT_TIMEOUT_MS = 15000;

const MONTHS_IT = Object.freeze({
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
});

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(value) {
  if (!value) return null;
  try {
    return new URL(value, BASE_URL).toString();
  } catch {
    return null;
  }
}

function dateOnlyUtc(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function parseItalianDate(value) {
  const match = normalizeSpace(value).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  return dateOnlyUtc(Number(match[3]), Number(match[2]), Number(match[1]));
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseArchiveIssues(html) {
  const $ = cheerio.load(String(html || ''));
  const issues = [];
  const seen = new Set();

  $('a').each((_, element) => {
    const text = normalizeSpace($(element).text());
    const match = text.match(/n[°º]\s*(\d+)\s+del\s+(\d{2}-\d{2}-\d{4})/i);
    if (!match) return;

    const number = Number(match[1]);
    const date = parseItalianDate(match[2]);
    if (!Number.isFinite(number) || !date) return;

    const key = `${number}:${isoDate(date)}`;
    if (seen.has(key)) return;
    seen.add(key);

    const dateString = isoDate(date);
    issues.push({
      number,
      date,
      dateString,
      url: `${BASE_URL}/gazzetta/serie_generale/caricaDettaglio/home?dataPubblicazioneGazzetta=${dateString}&numeroGazzetta=${number}`,
    });
  });

  return issues.sort((a, b) => a.date - b.date || a.number - b.number);
}

function extractRedactionCode(value) {
  const text = String(value || '');
  const direct = text.match(/\b(\d{2}[A-Z]\d{5})\b/i);
  if (direct) return direct[1].toUpperCase();

  const fromUrl = text.match(/\/([0-9]{2}[A-Z][0-9]{5})(?:\/|\?|$)/i);
  return fromUrl ? fromUrl[1].toUpperCase() : null;
}

function parseIssueReferendumCandidates(html, issue) {
  const $ = cheerio.load(String(html || ''));
  const candidates = [];
  const seen = new Set();

  $('a').each((_, element) => {
    const text = normalizeSpace($(element).text());
    if (!/referendum/i.test(text)) return;

    const href = toAbsoluteUrl($(element).attr('href'));
    const externalId = extractRedactionCode(text) || extractRedactionCode(href);
    if (!externalId) return;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const publicationDate = issue?.dateString || null;
    const fullTextUrl = publicationDate
      ? `${BASE_URL}/atto/vediMenuHTML?atto.codiceRedazionale=${encodeURIComponent(externalId)}&atto.dataPubblicazioneGazzetta=${publicationDate}&tipoSerie=serie_generale&tipoVigenza=originario`
      : href;
    const permalink = publicationDate
      ? `${BASE_URL}/eli/id/${publicationDate.replace(/-/g, '/')}/${externalId}/sg`
      : href;

    candidates.push({
      externalId,
      title: text,
      href,
      sourceUrl: permalink,
      fullTextUrl,
      publicationDate,
      issueNumber: issue?.number ?? null,
    });
  });

  return candidates;
}

function romeLocalToUtcIso({ year, month, day, hour, minute = 0 }) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcMillis))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)])
    );
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second || 0,
    );
    const offset = representedAsUtc - utcMillis;
    utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0) - offset;
  }
  return new Date(utcMillis).toISOString();
}

function extractPollDates(text, fallbackYear) {
  const normalized = normalizeSpace(text).toLowerCase();
  const sectionMatch = normalized.match(/(?:i relativi\s+)?comizi\s+(?:sono\s+)?convocati\s+per\s+(?:il giorno|i giorni)\s+di\s+(.+?)(?:\.|;)/i);
  if (!sectionMatch) return [];

  const fragment = sectionMatch[1];
  const raw = [];
  const regex = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/gi;
  let match;
  while ((match = regex.exec(fragment)) !== null) {
    raw.push({
      day: Number(match[1]),
      month: MONTHS_IT[match[2].toLowerCase()],
      year: match[3] ? Number(match[3]) : null,
    });
  }
  if (!raw.length) return [];

  const explicitYear = [...raw].reverse().find((entry) => entry.year)?.year || fallbackYear;
  return raw
    .map((entry) => ({ ...entry, year: entry.year || explicitYear }))
    .filter((entry) => Number.isFinite(entry.year) && Number.isFinite(entry.month) && Number.isFinite(entry.day));
}

function extractQuestion(text) {
  const normalized = normalizeSpace(text);
  const patterns = [
    /sul seguente quesito(?:,\s*come riformulato[^:]*)?\s*:\s*[«"]?(.+?\?)[»"]?(?=\s+(?:I relativi comizi|Il presente decreto|Dato a Roma))/i,
    /seguente quesito\s*:\s*[«"]?(.+?\?)[»"]?/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return normalizeSpace(match[1]).replace(/^[«"]|[»"]$/g, '').trim();
  }
  return null;
}

function detectBallotKind(text) {
  const normalized = normalizeSpace(text).toLowerCase();
  if (/confermativ|art\.?\s*138/.test(normalized)) return 'constitutional_confirmatory';
  if (/abrogativ|art\.?\s*75/.test(normalized)) return 'abrogative';
  return 'referendum';
}

function buildMeanings(kind) {
  if (kind === 'abrogative') {
    return {
      yesMeaning: 'Approva l’abrogazione indicata nel quesito.',
      noMeaning: 'Respinge l’abrogazione e mantiene la disciplina oggetto del quesito.',
      quorumKind: 'turnout_threshold',
      quorumThreshold: 0.5,
    };
  }
  if (kind === 'constitutional_confirmatory') {
    return {
      yesMeaning: 'Approva il testo della legge costituzionale oggetto del quesito.',
      noMeaning: 'Respinge il testo della legge costituzionale oggetto del quesito.',
      quorumKind: 'none',
      quorumThreshold: null,
    };
  }
  return {
    yesMeaning: 'Esprime voto favorevole al quesito.',
    noMeaning: 'Esprime voto contrario al quesito.',
    quorumKind: 'custom',
    quorumThreshold: null,
  };
}

function cleanTitle(candidateTitle, externalId) {
  let title = normalizeSpace(candidateTitle)
    .replace(new RegExp(`\\(${externalId}\\).*`, 'i'), '')
    .replace(/\s+Pag\.?\s*\d+.*$/i, '')
    .trim();
  if (!title) title = `Referendum ${externalId}`;
  return title;
}

function parseOfficialGazetteReferendumAct(html, candidate, now = new Date()) {
  const $ = cheerio.load(String(html || ''));
  const text = normalizeSpace($.root().text());
  if (!/referendum/i.test(text)) return null;
  if (!/(?:indizione|indetto|indetta|si terra|si terrà)/i.test(text)) return null;

  const publicationYear = candidate?.publicationDate
    ? Number(candidate.publicationDate.slice(0, 4))
    : now.getUTCFullYear();
  const question = extractQuestion(text);
  const pollDates = extractPollDates(text, publicationYear);
  if (!question || pollDates.length === 0) return null;

  const first = pollDates[0];
  const last = pollDates[pollDates.length - 1];
  const opensAt = romeLocalToUtcIso({ ...first, hour: 7 });
  const closesAt = romeLocalToUtcIso({ ...last, hour: pollDates.length > 1 ? 15 : 23 });
  if (new Date(closesAt) <= new Date(opensAt)) return null;

  const kind = detectBallotKind(`${candidate?.title || ''} ${text}`);
  const meanings = buildMeanings(kind);
  const status = new Date(closesAt) <= now ? 'closed' : 'scheduled';
  const stageId = status === 'closed' ? 'closed' : 'ballot_scheduled';
  const externalId = candidate?.externalId || extractRedactionCode(text) || extractRedactionCode(candidate?.sourceUrl);
  if (!externalId || !candidate?.sourceUrl) return null;

  return {
    jurisdictionId: JURISDICTION_ID,
    processTypeId: PROCESS_TYPE_ID,
    sourceId: SOURCE_ID,
    externalId,
    sourceUri: `urn:gu:${externalId}`,
    sourceUrl: candidate.sourceUrl,
    title: cleanTitle(candidate.title, externalId),
    stageId,
    sourceStatus: status,
    officialReference: `GU:${externalId}`,
    officialIdentifiers: [
      { namespace: 'it.official_gazette.redaction_code', value: externalId },
    ],
    presentedAt: candidate.publicationDate || null,
    statusUpdatedAt: candidate.publicationDate || null,
    metadata: {
      gazetteIssueNumber: candidate.issueNumber ?? null,
      gazettePublicationDate: candidate.publicationDate || null,
      ballot: {
        kind,
        question,
        yesMeaning: meanings.yesMeaning,
        noMeaning: meanings.noMeaning,
        opensAt,
        closesAt,
        timezone: 'Europe/Rome',
        quorumKind: meanings.quorumKind,
        quorumThreshold: meanings.quorumThreshold,
        status,
      },
    },
  };
}

async function defaultHttpGet(url) {
  const response = await axios.get(url, {
    timeout: DEFAULT_TIMEOUT_MS,
    responseType: 'text',
    headers: {
      'User-Agent': 'DEMOS civic source synchronizer/1.0 (+https://www.demos.community)',
      Accept: 'text/html,application/xhtml+xml',
    },
    maxRedirects: 5,
  });
  return response.data;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function readSyncState(pool) {
  try {
    const result = await pool.query(
      `SELECT last_successful_sync_at
         FROM civic_source_sync_state
        WHERE source_id = $1`,
      [SOURCE_ID],
    );
    return result.rows[0]?.last_successful_sync_at ? new Date(result.rows[0].last_successful_sync_at) : null;
  } catch (error) {
    if (error?.code === '42P01') return null;
    throw error;
  }
}

async function writeSyncState(pool, { success, errorMessage = null, now = new Date() }) {
  try {
    await pool.query(
      `INSERT INTO civic_source_sync_state (source_id, last_successful_sync_at, last_error, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (source_id)
       DO UPDATE SET
         last_successful_sync_at = CASE WHEN $4::boolean THEN EXCLUDED.last_successful_sync_at ELSE civic_source_sync_state.last_successful_sync_at END,
         last_error = EXCLUDED.last_error,
         updated_at = NOW()`,
      [SOURCE_ID, success ? now.toISOString() : null, errorMessage, success],
    );
  } catch (error) {
    if (error?.code !== '42P01') throw error;
  }
}

async function fetchOfficialGazetteReferendumRecords({
  pool,
  now = new Date(),
  httpGet = defaultHttpGet,
  bootstrapLookbackDays = Number(process.env.GAZETTE_BOOTSTRAP_LOOKBACK_DAYS || DEFAULT_BOOTSTRAP_LOOKBACK_DAYS),
  incrementalOverlapDays = Number(process.env.GAZETTE_INCREMENTAL_OVERLAP_DAYS || DEFAULT_INCREMENTAL_OVERLAP_DAYS),
  issueConcurrency = 4,
  actConcurrency = 3,
} = {}) {
  if (!pool?.query) throw new Error('DATABASE_POOL_REQUIRED');

  const lastSuccessful = await readSyncState(pool);
  const fallbackDays = Math.max(1, Number.isFinite(bootstrapLookbackDays) ? bootstrapLookbackDays : DEFAULT_BOOTSTRAP_LOOKBACK_DAYS);
  const overlapDays = Math.max(1, Number.isFinite(incrementalOverlapDays) ? incrementalOverlapDays : DEFAULT_INCREMENTAL_OVERLAP_DAYS);
  const cutoff = lastSuccessful
    ? new Date(lastSuccessful.getTime() - overlapDays * 86400000)
    : new Date(now.getTime() - fallbackDays * 86400000);

  const errors = [];
  const issues = [];
  const startYear = cutoff.getUTCFullYear();
  const endYear = now.getUTCFullYear();

  for (let year = startYear; year <= endYear; year += 1) {
    const archiveUrl = `${BASE_URL}/ricercaArchivioCompleto/serie_generale/${year}`;
    try {
      const archiveHtml = await httpGet(archiveUrl);
      for (const issue of parseArchiveIssues(archiveHtml)) {
        if (issue.date < cutoff || issue.date > now) continue;
        issues.push(issue);
      }
    } catch (error) {
      errors.push({ stage: 'archive', year, error: error.message });
    }
  }

  const issueResults = await mapLimit(issues, issueConcurrency, async (issue) => {
    try {
      const html = await httpGet(issue.url);
      return parseIssueReferendumCandidates(html, issue);
    } catch (error) {
      errors.push({ stage: 'issue', issue: issue.number, date: issue.dateString, error: error.message });
      return [];
    }
  });

  const candidates = issueResults.flat();
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.externalId, candidate])).values()];
  const records = [];

  await mapLimit(uniqueCandidates, actConcurrency, async (candidate) => {
    try {
      const html = await httpGet(candidate.fullTextUrl);
      const record = parseOfficialGazetteReferendumAct(html, candidate, now);
      if (record) records.push(record);
    } catch (error) {
      errors.push({ stage: 'act', externalId: candidate.externalId, error: error.message });
    }
  });

  // Il checkpoint NON viene avanzato qui: il caller lo conferma solo dopo che
  // tutti i record recuperati sono stati persistiti con successo. In questo modo
  // un errore di ingestione non rende invisibile il record al ciclo successivo.
  return {
    records,
    errors,
    scannedIssues: issues.length,
    referendumCandidates: uniqueCandidates.length,
    cutoff: cutoff.toISOString(),
    lastSuccessfulSyncAt: lastSuccessful?.toISOString() || null,
    scanCompletedAt: now.toISOString(),
  };
}

module.exports = {
  SOURCE_ID,
  parseArchiveIssues,
  parseIssueReferendumCandidates,
  parseOfficialGazetteReferendumAct,
  extractQuestion,
  extractPollDates,
  detectBallotKind,
  romeLocalToUtcIso,
  readSyncState,
  writeSyncState,
  fetchOfficialGazetteReferendumRecords,
};
