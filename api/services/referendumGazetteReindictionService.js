'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const {
  parseArchiveIssues,
  parseIssueReferendumCandidates,
  parseOfficialGazetteReferendumAct,
} = require('./civicSources/italyOfficialGazetteReferendumAdapter');
const { chooseLifecycleTarget } = require('./referendumGazetteLifecycleService');

const GAZETTE_SOURCE_ID = 'it.official_gazette';
const REINDICTION_SYNC_ID = 'it.official_gazette.reindiction';
const BASE_URL = 'https://www.gazzettaufficiale.it';
const DEFAULT_BOOTSTRAP_LOOKBACK_DAYS = 120;
const DEFAULT_INCREMENTAL_OVERLAP_DAYS = 3;
const DEFAULT_TIMEOUT_MS = 15000;

const MONTHS_IT = Object.freeze({
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
});

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value) {
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
  return new Date(Date.UTC(numericYear, month - 1, numericDay, 12)).toISOString().slice(0, 10);
}

function extractReindictionPredecessorPublicationDate(text) {
  const normalized = normalizeSpace(text);
  const monthPattern = '(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)';

  // Caso ufficiale osservato nel 2020: il nuovo decreto di indizione richiama
  // la revoca precedente e, dentro lo stesso periodo, il decreto originario
  // "pubblicato ... del 29 gennaio 2020, con il quale e' stato indetto...".
  // Si prende soltanto la data DOPO "revocato il decreto", non la data della revoca.
  const pattern = new RegExp(
    `revocat[oa][\\s\\S]{0,260}?decreto[\\s\\S]{0,900}?pubblicat[oa][\\s\\S]{0,360}?Gazzetta\\s+Ufficiale[\\s\\S]{0,260}?\\bdel\\s+(\\d{1,2})\\s+${monthPattern}\\s+(\\d{4})[\\s\\S]{0,520}?(?:con\\s+il\\s+quale|col\\s+quale)[\\s\\S]{0,220}?indett[oa]`,
    'i',
  );
  const match = normalized.match(pattern);
  if (!match) return null;
  return parseItalianDateWords(match[1], match[2], match[3]);
}

function parseOfficialGazetteReindictionAct(html, candidate, now = new Date()) {
  const text = normalizeSpace(cheerio.load(String(html || '')).root().text());
  if (!/referendum/i.test(text)) return null;

  // Deve essere una vera nuova indizione con un quesito e nuove date. Questo
  // esclude l'atto di sola revoca, che cita la vecchia indizione ma non convoca
  // nuovi comizi.
  const scheduledRecord = parseOfficialGazetteReferendumAct(html, candidate, now);
  if (!scheduledRecord?.metadata?.ballot) return null;

  const predecessorPublicationDate = extractReindictionPredecessorPublicationDate(text);
  if (!predecessorPublicationDate) return null;

  return {
    action: 'reindicted',
    externalId: scheduledRecord.externalId,
    sourceUrl: scheduledRecord.sourceUrl,
    publicationDate: scheduledRecord.presentedAt,
    predecessorPublicationDate,
    question: scheduledRecord.metadata.ballot.question,
    searchText: normalizeSearchText(`${scheduledRecord.title} ${scheduledRecord.metadata.ballot.question} ${text}`),
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
      'SELECT last_successful_sync_at FROM civic_source_sync_state WHERE source_id = $1',
      [REINDICTION_SYNC_ID],
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
       ON CONFLICT (source_id) DO UPDATE SET
         last_successful_sync_at = CASE WHEN $4::boolean THEN EXCLUDED.last_successful_sync_at ELSE civic_source_sync_state.last_successful_sync_at END,
         last_error = EXCLUDED.last_error,
         updated_at = NOW()`,
      [REINDICTION_SYNC_ID, success ? now.toISOString() : null, errorMessage, success],
    );
  } catch (error) {
    if (error?.code !== '42P01') throw error;
  }
}

async function findPredecessorRows(client, record) {
  const result = await client.query(
    `SELECT sr.id AS source_record_id, sr.external_id, sr.civic_process_id,
            sr.source_title, sr.source_stage, sr.source_status, sr.payload_metadata
       FROM civic_process_source_records sr
      WHERE sr.source_id = $1
        AND sr.presented_at = $2::date
        AND sr.payload_metadata ? 'ballot'
      ORDER BY sr.status_updated_at DESC NULLS LAST, sr.last_seen_at DESC`,
    [GAZETTE_SOURCE_ID, record.predecessorPublicationDate],
  );
  return result.rows;
}

async function readBallotUsage(client, civicProcessId) {
  const result = await client.query(
    `SELECT b.id,
            EXISTS (SELECT 1 FROM civic_ballot_positions p WHERE p.civic_ballot_id = b.id) AS has_positions,
            EXISTS (SELECT 1 FROM civic_ballot_forecast_snapshots s WHERE s.civic_ballot_id = b.id) AS has_snapshots
       FROM civic_ballots b
      WHERE b.civic_process_id = $1
      FOR UPDATE OF b`,
    [civicProcessId],
  );
  return result.rows[0] || null;
}

async function annotateReindictionSource(client, record, targetProcessId, predecessorSourceRecordId) {
  await client.query(
    `UPDATE civic_process_source_records
        SET payload_metadata = COALESCE(payload_metadata, '{}'::jsonb) || jsonb_build_object(
              'lifecycle', jsonb_build_object(
                'action', 'reindicted',
                'predecessorPublicationDate', $3::text,
                'predecessorSourceRecordId', $4::text
              )
            ),
            reconciliation_method = 'official_reference',
            updated_at = NOW()
      WHERE source_id = $1 AND external_id = $2 AND civic_process_id = $5`,
    [GAZETTE_SOURCE_ID, record.externalId, record.predecessorPublicationDate, predecessorSourceRecordId, targetProcessId],
  );
}

async function applyReindictionRecord(pool, record) {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;

    const predecessorRows = await findPredecessorRows(client, record);
    const target = chooseLifecycleTarget(predecessorRows, record);
    if (target.status !== 'matched') {
      await client.query('ROLLBACK');
      inTransaction = false;
      return { status: target.status, candidateCount: predecessorRows.length, score: target.score };
    }

    const current = await client.query(
      `SELECT sr.id AS source_record_id, sr.civic_process_id,
              cp.jurisdiction_id, cp.process_type_id, cp.canonical_stage,
              cp.canonical_url, cp.official_reference,
              cp.first_official_date, cp.latest_official_date
         FROM civic_process_source_records sr
         JOIN civic_processes cp ON cp.id = sr.civic_process_id
        WHERE sr.source_id = $1 AND sr.external_id = $2
        LIMIT 1
        FOR UPDATE OF sr, cp`,
      [GAZETTE_SOURCE_ID, record.externalId],
    );
    const currentRow = current.rows[0];
    if (!currentRow) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return { status: 'pending_current_source' };
    }

    const targetProcessId = String(target.row.civic_process_id);
    const currentProcessId = String(currentRow.civic_process_id);
    if (targetProcessId === currentProcessId) {
      await annotateReindictionSource(client, record, targetProcessId, target.row.source_record_id);
      await client.query('COMMIT');
      inTransaction = false;
      return { status: 'applied', merged: false, civicProcessId: targetProcessId };
    }

    const targetProcess = await client.query(
      `SELECT id, jurisdiction_id, process_type_id, canonical_stage,
              canonical_url, official_reference, first_official_date, latest_official_date
         FROM civic_processes
        WHERE id = $1
        FOR UPDATE`,
      [targetProcessId],
    );
    const targetRow = targetProcess.rows[0];
    if (!targetRow) throw new Error('GAZETTE_REINDICTION_TARGET_NOT_FOUND');
    if (targetRow.jurisdiction_id !== currentRow.jurisdiction_id || targetRow.process_type_id !== currentRow.process_type_id) {
      throw new Error('GAZETTE_REINDICTION_PROCESS_MISMATCH');
    }

    // Normalmente questo merge avviene nello stesso ciclo, prima della proiezione
    // in civic_ballots. Se per un retry tardivo il processo duplicato ha gia'
    // raccolto dati utente o snapshot, non li cancelliamo: il caso viene bloccato
    // per una riconciliazione esplicita invece di rischiare perdita di dati.
    const currentBallot = await readBallotUsage(client, currentProcessId);
    const targetBallot = await readBallotUsage(client, targetProcessId);
    if (currentBallot?.has_positions || currentBallot?.has_snapshots) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return { status: 'unsafe_duplicate_ballot_usage' };
    }
    if (currentBallot) {
      if (targetBallot) {
        await client.query('DELETE FROM civic_ballots WHERE id = $1', [currentBallot.id]);
      } else {
        await client.query('UPDATE civic_ballots SET civic_process_id = $2, updated_at = NOW() WHERE id = $1', [currentBallot.id, targetProcessId]);
      }
    }

    await client.query(
      `UPDATE civic_process_identifiers
          SET civic_process_id = $2
        WHERE civic_process_id = $1`,
      [currentProcessId, targetProcessId],
    );
    await client.query(
      `UPDATE civic_process_source_records
          SET civic_process_id = $2,
              reconciliation_method = 'official_reference',
              updated_at = NOW()
        WHERE civic_process_id = $1`,
      [currentProcessId, targetProcessId],
    );
    await client.query(
      'DELETE FROM civic_process_reconciliation_candidates WHERE candidate_process_id = $1',
      [currentProcessId],
    );

    await client.query(
      `UPDATE civic_processes
          SET canonical_stage = COALESCE($2, canonical_stage),
              canonical_url = COALESCE($3, canonical_url),
              official_reference = COALESCE(official_reference, $4),
              first_official_date = CASE
                WHEN $5::date IS NULL THEN first_official_date
                WHEN first_official_date IS NULL THEN $5::date
                ELSE LEAST(first_official_date, $5::date)
              END,
              latest_official_date = CASE
                WHEN $6::date IS NULL THEN latest_official_date
                WHEN latest_official_date IS NULL THEN $6::date
                ELSE GREATEST(latest_official_date, $6::date)
              END,
              updated_at = NOW()
        WHERE id = $1`,
      [
        targetProcessId,
        currentRow.canonical_stage,
        currentRow.canonical_url,
        currentRow.official_reference,
        currentRow.first_official_date,
        currentRow.latest_official_date,
      ],
    );

    await client.query('DELETE FROM civic_processes WHERE id = $1', [currentProcessId]);
    await annotateReindictionSource(client, record, targetProcessId, target.row.source_record_id);

    await client.query('COMMIT');
    inTransaction = false;
    return {
      status: 'applied',
      merged: true,
      civicProcessId: targetProcessId,
      previousProcessId: currentProcessId,
      score: target.score,
    };
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function syncOfficialGazetteReferendumReindictions({
  pool,
  now = new Date(),
  httpGet = defaultHttpGet,
  bootstrapLookbackDays = Number(process.env.GAZETTE_REINDICTION_BOOTSTRAP_LOOKBACK_DAYS || DEFAULT_BOOTSTRAP_LOOKBACK_DAYS),
  incrementalOverlapDays = Number(process.env.GAZETTE_REINDICTION_INCREMENTAL_OVERLAP_DAYS || DEFAULT_INCREMENTAL_OVERLAP_DAYS),
  issueConcurrency = 4,
  actConcurrency = 3,
} = {}) {
  if (!pool?.query || !pool?.connect) throw new Error('DATABASE_POOL_REQUIRED');

  const lastSuccessful = await readSyncState(pool);
  const fallbackDays = Math.max(1, Number.isFinite(bootstrapLookbackDays) ? bootstrapLookbackDays : DEFAULT_BOOTSTRAP_LOOKBACK_DAYS);
  const overlapDays = Math.max(1, Number.isFinite(incrementalOverlapDays) ? incrementalOverlapDays : DEFAULT_INCREMENTAL_OVERLAP_DAYS);
  const cutoff = lastSuccessful
    ? new Date(lastSuccessful.getTime() - overlapDays * 86400000)
    : new Date(now.getTime() - fallbackDays * 86400000);

  const errors = [];
  const issues = [];
  for (let year = cutoff.getUTCFullYear(); year <= now.getUTCFullYear(); year += 1) {
    try {
      const archiveHtml = await httpGet(`${BASE_URL}/ricercaArchivioCompleto/serie_generale/${year}`);
      for (const issue of parseArchiveIssues(archiveHtml)) {
        if (issue.date >= cutoff && issue.date <= now) issues.push(issue);
      }
    } catch (error) {
      errors.push({ stage: 'archive', year, error: error.message });
    }
  }

  const issueResults = await mapLimit(issues, issueConcurrency, async (issue) => {
    try {
      return parseIssueReferendumCandidates(await httpGet(issue.url), issue);
    } catch (error) {
      errors.push({ stage: 'issue', issue: issue.number, date: issue.dateString, error: error.message });
      return [];
    }
  });
  const candidates = [...new Map(issueResults.flat().map((candidate) => [candidate.externalId, candidate])).values()];
  const records = [];
  await mapLimit(candidates, actConcurrency, async (candidate) => {
    try {
      const record = parseOfficialGazetteReindictionAct(await httpGet(candidate.fullTextUrl), candidate, now);
      if (record) records.push(record);
    } catch (error) {
      errors.push({ stage: 'act', externalId: candidate.externalId, error: error.message });
    }
  });

  let ingested = 0;
  let pending = 0;
  let ambiguous = 0;
  let unsafe = 0;
  for (const record of records) {
    try {
      const outcome = await applyReindictionRecord(pool, record);
      if (outcome.status === 'applied') ingested += 1;
      else if (outcome.status === 'ambiguous') ambiguous += 1;
      else if (outcome.status === 'unsafe_duplicate_ballot_usage') unsafe += 1;
      else pending += 1;
    } catch (error) {
      errors.push({ stage: 'apply', externalId: record.externalId, error: error.message });
    }
  }

  const success = errors.length === 0 && pending === 0 && ambiguous === 0 && unsafe === 0 && ingested === records.length;
  await writeSyncState(pool, {
    success,
    errorMessage: success ? null : [
      ...errors.slice(0, 2).map((entry) => entry.error),
      pending ? `pending=${pending}` : null,
      ambiguous ? `ambiguous=${ambiguous}` : null,
      unsafe ? `unsafe=${unsafe}` : null,
    ].filter(Boolean).join(' | '),
    now,
  });

  return {
    fetched: records.length,
    ingested,
    pending,
    ambiguous,
    unsafe,
    scannedIssues: issues.length,
    referendumCandidates: candidates.length,
    cutoff: cutoff.toISOString(),
    lastSuccessfulSyncAt: success ? now.toISOString() : lastSuccessful?.toISOString() || null,
    errors,
  };
}

module.exports = {
  GAZETTE_SOURCE_ID,
  REINDICTION_SYNC_ID,
  extractReindictionPredecessorPublicationDate,
  parseOfficialGazetteReindictionAct,
  applyReindictionRecord,
  syncOfficialGazetteReferendumReindictions,
};
