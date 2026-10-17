'use strict';

const { ingestCivicSourceRecord } = require('./civicProcessPersistenceService');
const {
  SOURCE_ID,
  PUBLIC_URL,
  yyyymmddInRome,
  fetchNationalPayloads,
  resolveNationalResultFromPayloads,
} = require('./civicSources/italyInteriorEligendoReferendumAdapter');

const DEFAULT_LOOKBACK_DAYS = 90;

function ballotMetadata(candidate) {
  const metadata = candidate?.payload_metadata && typeof candidate.payload_metadata === 'object'
    ? candidate.payload_metadata
    : {};
  return metadata.ballot && typeof metadata.ballot === 'object' ? metadata.ballot : null;
}

async function listEligibleResultCandidates(pool, { lookbackDays = DEFAULT_LOOKBACK_DAYS } = {}) {
  const days = Math.max(1, Math.min(365, Number.parseInt(String(lookbackDays), 10) || DEFAULT_LOOKBACK_DAYS));
  const result = await pool.query(
    `SELECT
       sr.civic_process_id,
       COALESCE(NULLIF(cp.canonical_title, ''), sr.source_title) AS title,
       COALESCE(cp.official_reference, sr.official_reference) AS official_reference,
       sr.presented_at,
       sr.payload_metadata,
       COALESCE(
         jsonb_agg(
           DISTINCT jsonb_build_object('namespace', ci.namespace, 'value', ci.value)
         ) FILTER (WHERE ci.namespace IS NOT NULL AND ci.value IS NOT NULL),
         '[]'::jsonb
       ) AS official_identifiers
     FROM civic_process_source_records sr
     JOIN civic_processes cp ON cp.id = sr.civic_process_id
     LEFT JOIN civic_process_identifiers ci ON ci.civic_process_id = sr.civic_process_id
     WHERE cp.process_type_id = 'it.referendum_signature_request'
       AND sr.source_id = 'it.official_gazette'
       AND sr.payload_metadata ? 'ballot'
       AND NULLIF(sr.payload_metadata #>> '{ballot,closesAt}', '')::timestamptz <= NOW()
       AND NULLIF(sr.payload_metadata #>> '{ballot,closesAt}', '')::timestamptz >= NOW() - ($1::int * INTERVAL '1 day')
       AND NOT EXISTS (
         SELECT 1
         FROM civic_process_source_records er
         WHERE er.civic_process_id = sr.civic_process_id
           AND er.source_id = $2
           AND er.payload_metadata #>> '{ballot,officialResult,complete}' = 'true'
       )
     GROUP BY
       sr.civic_process_id,
       cp.canonical_title,
       cp.official_reference,
       sr.source_title,
       sr.official_reference,
       sr.presented_at,
       sr.payload_metadata
     ORDER BY sr.civic_process_id`,
    [days, SOURCE_ID],
  );
  return result.rows;
}

async function ingestOne(pool, record) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await ingestCivicSourceRecord(client, record);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function buildSourceRecord(candidate, { electionDate, questionCode, mappingMethod, result }) {
  const originalMetadata = candidate.payload_metadata && typeof candidate.payload_metadata === 'object'
    ? candidate.payload_metadata
    : {};
  const originalBallot = ballotMetadata(candidate) || {};
  const updatedAt = result.updatedAt || new Date().toISOString();

  return {
    jurisdictionId: 'it',
    processTypeId: 'it.referendum_signature_request',
    sourceId: SOURCE_ID,
    externalId: `${electionDate}:${String(questionCode).padStart(2, '0')}`,
    sourceUri: `urn:eligendo:referendum:${electionDate}:${String(questionCode).padStart(2, '0')}`,
    sourceUrl: PUBLIC_URL,
    title: candidate.title,
    stageId: 'closed',
    sourceStatus: 'closed',
    officialReference: candidate.official_reference || null,
    officialIdentifiers: Array.isArray(candidate.official_identifiers) ? candidate.official_identifiers : [],
    presentedAt: candidate.presented_at || null,
    statusUpdatedAt: updatedAt,
    metadata: {
      ...originalMetadata,
      provider: {
        source: SOURCE_ID,
        authority: 'Ministero dell’Interno',
        electionDate,
        electionType: '09',
        questionCode: Number(questionCode),
        coverage: result.coverage,
      },
      ballot: {
        ...originalBallot,
        status: 'closed',
        eligendoQuestionCode: Number(questionCode),
        eligendoQuestionMapping: mappingMethod,
        officialResult: {
          complete: true,
          turnoutPercent: result.turnoutPercent,
          yesPercent: result.yesPercent,
          noPercent: result.noPercent,
          electorCount: result.electorCount,
          voterCount: result.voterCount,
          yesVotes: result.yesVotes,
          noVotes: result.noVotes,
          blankVotes: result.blankVotes,
          invalidVotes: result.invalidVotes,
          contestedVotes: result.contestedVotes,
          sectionsReported: result.sectionsReported,
          sectionsTotal: result.sectionsTotal,
          coverage: result.coverage,
          updatedAt,
        },
      },
    },
  };
}

async function syncItalianReferendumResults({
  pool,
  lookbackDays = Number(process.env.ELIGENDO_RESULTS_LOOKBACK_DAYS || DEFAULT_LOOKBACK_DAYS),
  fetchPayloads = fetchNationalPayloads,
} = {}) {
  if (!pool?.query || !pool?.connect) throw new Error('DATABASE_POOL_REQUIRED');

  const candidates = await listEligibleResultCandidates(pool, { lookbackDays });
  const byDate = new Map();
  let skipped = 0;

  for (const candidate of candidates) {
    const ballot = ballotMetadata(candidate);
    const electionDate = ballot?.opensAt ? yyyymmddInRome(ballot.opensAt) : null;
    if (!ballot || !electionDate) {
      skipped += 1;
      continue;
    }
    if (!byDate.has(electionDate)) byDate.set(electionDate, []);
    byDate.get(electionDate).push({ candidate, ballot });
  }

  let ingested = 0;
  let pending = 0;
  let ambiguous = 0;
  const errors = [];

  for (const [electionDate, entries] of byDate.entries()) {
    let payloads;
    try {
      payloads = await fetchPayloads({ electionDate });
    } catch (error) {
      errors.push({
        electionDate,
        code: error.code || 'ELIGENDO_FETCH_FAILED',
        error: error.message,
      });
      continue;
    }

    for (const { candidate, ballot } of entries) {
      const resolved = resolveNationalResultFromPayloads({
        ballot,
        candidateCountForDate: entries.length,
        italyPayload: payloads.italyPayload,
        abroadPayload: payloads.abroadPayload,
      });

      if (resolved.ambiguous) {
        ambiguous += 1;
        continue;
      }
      if (!resolved.available || !resolved.result?.complete) {
        pending += 1;
        continue;
      }

      const record = buildSourceRecord(candidate, {
        electionDate,
        questionCode: resolved.questionCode,
        mappingMethod: resolved.mappingMethod,
        result: resolved.result,
      });

      try {
        await ingestOne(pool, record);
        ingested += 1;
      } catch (error) {
        errors.push({
          electionDate,
          civicProcessId: candidate.civic_process_id,
          code: error.code || 'ELIGENDO_INGEST_FAILED',
          error: error.message,
        });
      }
    }
  }

  return {
    eligendo: {
      fetched: candidates.length,
      ingested,
      datesQueried: byDate.size,
      pending,
      ambiguous,
      skipped,
      errors,
    },
  };
}

module.exports = {
  DEFAULT_LOOKBACK_DAYS,
  ballotMetadata,
  listEligibleResultCandidates,
  buildSourceRecord,
  syncItalianReferendumResults,
};
