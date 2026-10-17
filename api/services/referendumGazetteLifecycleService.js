'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const {
  parseArchiveIssues,
  parseIssueReferendumCandidates,
  extractQuestion,
} = require('./civicSources/italyOfficialGazetteReferendumAdapter');

const GAZETTE_SOURCE_ID = 'it.official_gazette';
const LIFECYCLE_SYNC_ID = 'it.official_gazette.lifecycle';
const BASE_URL = 'https://www.gazzettaufficiale.it';
const DEFAULT_BOOTSTRAP_LOOKBACK_DAYS = 45;
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

const MATCH_STOPWORDS = new Set([
  'della', 'delle', 'degli', 'dello', 'dalla', 'dalle', 'dagli', 'dallo',
  'nella', 'nelle', 'negli', 'nello', 'alla', 'alle', 'agli', 'allo',
  'dell', 'nell', 'sull', 'anche', 'come', 'sono', 'stato', 'stata',
  'referendum', 'popolare', 'decreto', 'presidente', 'repubblica', 'indizione',
  'concernente', 'legge', 'testo', 'quesito', 'approvato', 'approvata',
]);

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTitle(value) {
  return normalizeSpace(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[“”«»"'’`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseItalianDateWords(day, monthName, year) {
  const month = MONTHS_IT[String(monthName || '').toLowerCase()];
  const numericDay = Number(day);
  const numericYear = Number(year);
  if (!month || !Number.isInteger(numericDay) || !Number.isInteger(numericYear)) return null;
  if (numericDay < 1 || numericDay > 31) return null;
  return new Date(Date.UTC(numericYear, month - 1, numericDay, 12, 0, 0)).toISOString().slice(0, 10);
}

function extractReferencedIndictionPublicationDate(text) {
  const normalized = normalizeSpace(text);
  const monthPattern = '(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)';

  // Gli atti successivi reali richiamano il decreto precedente e la sua
  // pubblicazione in Gazzetta. Cerchiamo soltanto finestre che contengano
  // esplicitamente anche "indizione"/"indetto", così una diversa citazione
  // della Gazzetta nello stesso atto non può essere scambiata per il predecessore.
  const windowRegex = /(?:Visto\s+)?(?:il\s+)?(?:proprio\s+)?decreto\b[\s\S]{0,1800}?(?:;|(?=\s+Vista\s)|(?=\s+Visto\s)|(?=\s+Ritenuto\s))/gi;
  const windows = normalized.match(windowRegex) || [];

  for (const window of windows) {
    if (!/(?:indizione|indett[oa])/i.test(window)) continue;
    const publicationRegex = new RegExp(
      `pubblicat[oa][\\s\\S]{0,500}?Gazzetta\\s+Ufficiale[\\s\\S]{0,320}?\\bdel\\s+(\\d{1,2})\\s+${monthPattern}\\s+(\\d{4})`,
      'i',
    );
    const match = window.match(publicationRegex);
    if (!match) continue;
    const parsed = parseItalianDateWords(match[1], match[2], match[3]);
    if (parsed) return parsed;
  }

  return null;
}

function parseOfficialGazetteLifecycleAct(html, candidate) {
  const $ = cheerio.load(String(html || ''));
  const text = normalizeSpace($.root().text());
  const title = normalizeSpace(candidate?.title);
  const combined = `${title} ${text}`;
  if (!/referendum/i.test(combined)) return null;

  let action = null;
  if (/\brevoca\b/i.test(combined) && /(?:indizione|procedimento)[\s\S]{0,80}?referendum|referendum/i.test(combined)) {
    action = 'revoked';
  } else if (/precisazione\s+del\s+quesito|quesito[\s\S]{0,260}?riformulat/i.test(combined)) {
    action = 'reformulated';
  } else {
    return null;
  }

  const predecessorPublicationDate = extractReferencedIndictionPublicationDate(text);
  if (!predecessorPublicationDate) return null;

  const externalId = candidate?.externalId || null;
  if (!externalId || !candidate?.sourceUrl || !candidate?.publicationDate) return null;

  const newQuestion = action === 'reformulated' ? extractQuestion(text) : null;
  if (action === 'reformulated' && !newQuestion) return null;

  return {
    action,
    externalId,
    sourceUri: `urn:gu:${externalId}`,
    sourceUrl: candidate.sourceUrl,
    title: title || `Atto successivo referendum ${externalId}`,
    normalizedTitle: normalizeTitle(title || `Atto successivo referendum ${externalId}`),
    publicationDate: candidate.publicationDate,
    issueNumber: candidate.issueNumber ?? null,
    predecessorPublicationDate,
    newQuestion,
    searchText: normalizeTitle(combined),
  };
}

function meaningfulTokens(value) {
  return normalizeTitle(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !MATCH_STOPWORDS.has(token));
}

function coverageScore(needle, haystack) {
  const needleTokens = [...new Set(meaningfulTokens(needle))];
  if (!needleTokens.length) return 0;
  const haystackTokens = new Set(meaningfulTokens(haystack));
  const matched = needleTokens.filter((token) => haystackTokens.has(token)).length;
  return matched / needleTokens.length;
}

function chooseLifecycleTarget(rows, lifecycle) {
  const candidates = Array.isArray(rows) ? rows : [];
  if (candidates.length === 0) return { status: 'pending', row: null, score: 0 };
  if (candidates.length === 1) return { status: 'matched', row: candidates[0], score: 1 };

  const scored = candidates
    .map((row) => {
      const ballot = row?.payload_metadata?.ballot || {};
      const score = Math.max(
        coverageScore(ballot.question, lifecycle.searchText),
        coverageScore(row.source_title, lifecycle.searchText),
      );
      return { row, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  if (best.score >= 0.4 && (!second || best.score - second.score >= 0.12)) {
    return { status: 'matched', row: best.row, score: best.score };
  }
  return { status: 'ambiguous', row: null, score: best.score };
}

function mergeBallotForLifecycle(baseBallot, lifecycle) {
  const ballot = { ...(baseBallot || {}) };
  if (!ballot.question || !ballot.opensAt || !ballot.closesAt) return null;

  if (lifecycle.action === 'revoked') {
    ballot.status = 'cancelled';
    return ballot;
  }
  if (lifecycle.action === 'reformulated') {
    if (!lifecycle.newQuestion) return null;
    ballot.question = lifecycle.newQuestion;
    return ballot;
  }
  return null;
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

async function readLifecycleSyncState(pool) {
  try {
    const result = await pool.query(
      `SELECT last_successful_sync_at
         FROM civic_source_sync_state
        WHERE source_id = $1`,
      [LIFECYCLE_SYNC_ID],
    );
    return result.rows[0]?.last_successful_sync_at ? new Date(result.rows[0].last_successful_sync_at) : null;
  } catch (error) {
    if (error?.code === '42P01') return null;
    throw error;
  }
}

async function writeLifecycleSyncState(pool, { success, errorMessage = null, now = new Date() }) {
  try {
    await pool.query(
      `INSERT INTO civic_source_sync_state (source_id, last_successful_sync_at, last_error, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (source_id)
       DO UPDATE SET
         last_successful_sync_at = CASE WHEN $4::boolean THEN EXCLUDED.last_successful_sync_at ELSE civic_source_sync_state.last_successful_sync_at END,
         last_error = EXCLUDED.last_error,
         updated_at = NOW()`,
      [LIFECYCLE_SYNC_ID, success ? now.toISOString() : null, errorMessage, success],
    );
  } catch (error) {
    if (error?.code !== '42P01') throw error;
  }
}

async function findPredecessorRows(client, lifecycle) {
  const result = await client.query(
    `SELECT sr.id AS source_record_id,
            sr.civic_process_id,
            sr.source_title,
            sr.source_stage,
            sr.source_status,
            sr.payload_metadata
       FROM civic_process_source_records sr
      WHERE sr.source_id = $1
        AND sr.presented_at = $2::date
        AND sr.payload_metadata ? 'ballot'
      ORDER BY sr.status_updated_at DESC NULLS LAST, sr.last_seen_at DESC`,
    [GAZETTE_SOURCE_ID, lifecycle.predecessorPublicationDate],
  );
  return result.rows;
}

async function applyLifecycleRecord(pool, lifecycle) {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const predecessorRows = await findPredecessorRows(client, lifecycle);
    const target = chooseLifecycleTarget(predecessorRows, lifecycle);
    if (target.status !== 'matched') {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return { status: target.status, score: target.score, candidateCount: predecessorRows.length };
    }

    const baseMetadata = target.row.payload_metadata && typeof target.row.payload_metadata === 'object'
      ? target.row.payload_metadata
      : {};
    const mergedBallot = mergeBallotForLifecycle(baseMetadata.ballot, lifecycle);
    if (!mergedBallot) throw new Error('GAZETTE_LIFECYCLE_INVALID_BASE_BALLOT');

    const existingIdentifier = await client.query(
      `SELECT civic_process_id
         FROM civic_process_identifiers
        WHERE namespace = 'it.official_gazette.redaction_code' AND value = $1
        LIMIT 1`,
      [lifecycle.externalId],
    );
    const existingProcessId = existingIdentifier.rows[0]?.civic_process_id;
    if (existingProcessId && String(existingProcessId) !== String(target.row.civic_process_id)) {
      throw new Error('GAZETTE_LIFECYCLE_IDENTIFIER_CONFLICT');
    }

    const metadata = {
      ...baseMetadata,
      gazetteIssueNumber: lifecycle.issueNumber,
      gazettePublicationDate: lifecycle.publicationDate,
      ballot: mergedBallot,
      lifecycle: {
        action: lifecycle.action,
        predecessorPublicationDate: lifecycle.predecessorPublicationDate,
        predecessorSourceRecordId: target.row.source_record_id,
      },
    };
    const sourceStatus = mergedBallot.status || target.row.source_status || 'scheduled';

    await client.query(
      `INSERT INTO civic_process_source_records (
         civic_process_id, source_id, external_id, source_uri, source_url,
         source_title, normalized_title, source_stage, source_status,
         official_reference, presented_at, status_updated_at, payload_metadata,
         reconciliation_method
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
       ON CONFLICT (source_id, external_id)
       DO UPDATE SET
         civic_process_id = EXCLUDED.civic_process_id,
         source_uri = EXCLUDED.source_uri,
         source_url = EXCLUDED.source_url,
         source_title = EXCLUDED.source_title,
         normalized_title = EXCLUDED.normalized_title,
         source_stage = EXCLUDED.source_stage,
         source_status = EXCLUDED.source_status,
         official_reference = EXCLUDED.official_reference,
         presented_at = EXCLUDED.presented_at,
         status_updated_at = EXCLUDED.status_updated_at,
         payload_metadata = EXCLUDED.payload_metadata,
         reconciliation_method = EXCLUDED.reconciliation_method,
         last_seen_at = NOW(),
         updated_at = NOW()`,
      [
        target.row.civic_process_id,
        GAZETTE_SOURCE_ID,
        lifecycle.externalId,
        lifecycle.sourceUri,
        lifecycle.sourceUrl,
        lifecycle.title,
        lifecycle.normalizedTitle,
        target.row.source_stage,
        sourceStatus,
        `GU:${lifecycle.externalId}`,
        lifecycle.publicationDate,
        lifecycle.publicationDate,
        JSON.stringify(metadata),
        'official_reference',
      ],
    );

    await client.query(
      `INSERT INTO civic_process_identifiers (civic_process_id, namespace, value, source_id)
       VALUES ($1, 'it.official_gazette.redaction_code', $2, $3)
       ON CONFLICT (namespace, value) DO NOTHING`,
      [target.row.civic_process_id, lifecycle.externalId, GAZETTE_SOURCE_ID],
    );

    await client.query(
      `UPDATE civic_processes
          SET latest_official_date = CASE
                WHEN latest_official_date IS NULL THEN $2::date
                ELSE GREATEST(latest_official_date, $2::date)
              END,
              updated_at = NOW()
        WHERE id = $1`,
      [target.row.civic_process_id, lifecycle.publicationDate],
    );

    await client.query('COMMIT');
    transactionStarted = false;
    return {
      status: 'applied',
      civicProcessId: target.row.civic_process_id,
      action: lifecycle.action,
      score: target.score,
    };
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function syncOfficialGazetteReferendumLifecycle({
  pool,
  now = new Date(),
  httpGet = defaultHttpGet,
  bootstrapLookbackDays = Number(process.env.GAZETTE_LIFECYCLE_BOOTSTRAP_LOOKBACK_DAYS || DEFAULT_BOOTSTRAP_LOOKBACK_DAYS),
  incrementalOverlapDays = Number(process.env.GAZETTE_LIFECYCLE_INCREMENTAL_OVERLAP_DAYS || DEFAULT_INCREMENTAL_OVERLAP_DAYS),
  issueConcurrency = 4,
  actConcurrency = 3,
} = {}) {
  if (!pool?.query || !pool?.connect) throw new Error('DATABASE_POOL_REQUIRED');

  const lastSuccessful = await readLifecycleSyncState(pool);
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

  const candidates = [...new Map(issueResults.flat().map((candidate) => [candidate.externalId, candidate])).values()];
  const lifecycleRecords = [];
  await mapLimit(candidates, actConcurrency, async (candidate) => {
    try {
      const html = await httpGet(candidate.fullTextUrl);
      const lifecycle = parseOfficialGazetteLifecycleAct(html, candidate);
      if (lifecycle) lifecycleRecords.push(lifecycle);
    } catch (error) {
      errors.push({ stage: 'act', externalId: candidate.externalId, error: error.message });
    }
  });

  let ingested = 0;
  let pending = 0;
  let ambiguous = 0;
  for (const lifecycle of lifecycleRecords) {
    try {
      const outcome = await applyLifecycleRecord(pool, lifecycle);
      if (outcome.status === 'applied') ingested += 1;
      else if (outcome.status === 'pending') pending += 1;
      else if (outcome.status === 'ambiguous') ambiguous += 1;
    } catch (error) {
      errors.push({
        stage: 'apply',
        externalId: lifecycle.externalId,
        action: lifecycle.action,
        error: error.message,
      });
    }
  }

  const success = errors.length === 0 && pending === 0 && ambiguous === 0 && ingested === lifecycleRecords.length;
  await writeLifecycleSyncState(pool, {
    success,
    errorMessage: success
      ? null
      : [
          ...errors.slice(0, 2).map((entry) => entry.error),
          pending ? `pending=${pending}` : null,
          ambiguous ? `ambiguous=${ambiguous}` : null,
        ].filter(Boolean).join(' | '),
    now,
  });

  return {
    fetched: lifecycleRecords.length,
    ingested,
    pending,
    ambiguous,
    scannedIssues: issues.length,
    referendumCandidates: candidates.length,
    cutoff: cutoff.toISOString(),
    lastSuccessfulSyncAt: success ? now.toISOString() : lastSuccessful?.toISOString() || null,
    errors,
  };
}

module.exports = {
  GAZETTE_SOURCE_ID,
  LIFECYCLE_SYNC_ID,
  parseOfficialGazetteLifecycleAct,
  extractReferencedIndictionPublicationDate,
  chooseLifecycleTarget,
  mergeBallotForLifecycle,
  applyLifecycleRecord,
  syncOfficialGazetteReferendumLifecycle,
};
