'use strict';

const { getSignatureThreshold } = require('./civicProcessRegistryService');

const IT_POPULAR_INITIATIVE = 'it.popular_law_initiative';
const IT_JURISDICTION = 'it';
const SIGNATURE_SOURCE = 'it.justice.signature_portal';
const PRIORITY_SOURCE_STAGES = Object.freeze(['collection_closed', 'qualified']);
const PARLIAMENT_SOURCES = Object.freeze(['it.parliament.camera', 'it.parliament.senate']);

function isMissingCivicSchemaError(error) {
  return Boolean(error && error.code === '42P01' && /civic_process/i.test(String(error.message || '')));
}

function mapCanonicalPriorityRow(row) {
  const signatures = Number(row.signatures || 0);
  const threshold = getSignatureThreshold(IT_POPULAR_INITIATIVE);
  return {
    id: String(row.id),
    nome: row.canonical_title,
    titolo: row.canonical_title,
    descrizione: null,
    sitoWeb: row.site_url || row.canonical_url || null,
    sito_web: row.site_url || row.canonical_url || null,
    quorum: 'ufficiale',
    stato: row.canonical_stage,
    firme: signatures,
    firme_raccolte: signatures,
    signature_threshold: threshold,
    dataInizio: row.first_official_date || null,
    data_inizio: row.first_official_date || null,
    dataFine: null,
    data_fine: null,
    civic_process_id: String(row.id),
    civic_process_type: IT_POPULAR_INITIATIVE,
    civic_process_stage: row.canonical_stage,
    official_sources: Array.isArray(row.official_sources) ? row.official_sources : [],
    voti: Number(row.votes || 0),
  };
}

async function getPrioritySourceStatus(pool) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS signature_source_records
         FROM civic_process_source_records csr
         JOIN civic_processes cp ON cp.id = csr.civic_process_id
        WHERE csr.source_id = $1
          AND cp.jurisdiction_id = $2
          AND cp.process_type_id = $3`,
      [SIGNATURE_SOURCE, IT_JURISDICTION, IT_POPULAR_INITIATIVE]
    );
    return {
      schemaReady: true,
      signatureSourceRecords: Number(result.rows[0]?.signature_source_records || 0),
    };
  } catch (error) {
    if (isMissingCivicSchemaError(error)) {
      return { schemaReady: false, signatureSourceRecords: 0 };
    }
    throw error;
  }
}

async function listPriorityEligiblePopularInitiatives(pool) {
  const threshold = getSignatureThreshold(IT_POPULAR_INITIATIVE);
  if (!Number.isFinite(threshold) || threshold <= 0) return [];

  const result = await pool.query(
    `SELECT
       cp.id,
       cp.canonical_title,
       cp.canonical_stage,
       cp.canonical_url,
       cp.first_official_date,
       cp.latest_official_date,
       COALESCE(
         MAX(csr.source_url) FILTER (WHERE csr.source_id = ANY($4::text[]) AND csr.source_url IS NOT NULL),
         MAX(csr.source_url) FILTER (WHERE csr.source_id = $3 AND csr.source_url IS NOT NULL),
         cp.canonical_url
       ) AS site_url,
       COALESCE(
         MAX(
           CASE
             WHEN csr.source_id = $3
              AND COALESCE(csr.payload_metadata->>'signatures', '') ~ '^[0-9]+$'
             THEN (csr.payload_metadata->>'signatures')::int
             ELSE NULL
           END
         ),
         0
       )::int AS signatures,
       COALESCE(COUNT(DISTINCT vip.id), 0)::int AS votes,
       COALESCE(
         jsonb_agg(DISTINCT jsonb_build_object(
           'sourceId', csr.source_id,
           'externalId', csr.external_id,
           'sourceUrl', csr.source_url,
           'sourceStage', csr.source_stage,
           'sourceStatus', csr.source_status
         )) FILTER (WHERE csr.source_id = ANY($4::text[])),
         '[]'::jsonb
       ) AS official_sources
     FROM civic_processes cp
     JOIN civic_process_source_records csr ON csr.civic_process_id = cp.id
     LEFT JOIN voti_iniziative_popolari vip ON vip.iniziativa_id = cp.id::text
     WHERE cp.jurisdiction_id = $1
       AND cp.process_type_id = $2
       AND COALESCE(cp.realized, false) = false
       AND EXISTS (
         SELECT 1
           FROM civic_process_source_records signature_source
          WHERE signature_source.civic_process_id = cp.id
            AND signature_source.source_id = $3
            AND signature_source.source_stage = ANY($5::text[])
            AND COALESCE(signature_source.payload_metadata->>'signatures', '') ~ '^[0-9]+$'
            AND (signature_source.payload_metadata->>'signatures')::int >= $6
            AND COALESCE((signature_source.payload_metadata->>'quorumReached')::boolean, false) = true
       )
     GROUP BY cp.id, cp.canonical_title, cp.canonical_stage, cp.canonical_url,
              cp.first_official_date, cp.latest_official_date
     ORDER BY votes DESC, cp.latest_official_date DESC NULLS LAST, cp.canonical_title ASC`,
    [IT_JURISDICTION, IT_POPULAR_INITIATIVE, SIGNATURE_SOURCE, PARLIAMENT_SOURCES, PRIORITY_SOURCE_STAGES, threshold]
  );

  return result.rows.map(mapCanonicalPriorityRow);
}

async function getPriorityEligiblePopularInitiative(poolOrClient, civicProcessId) {
  const id = String(civicProcessId || '').trim();
  if (!id) return null;
  const threshold = getSignatureThreshold(IT_POPULAR_INITIATIVE);
  if (!Number.isFinite(threshold) || threshold <= 0) return null;

  const result = await poolOrClient.query(
    `SELECT cp.id, cp.canonical_title, cp.canonical_stage
       FROM civic_processes cp
      WHERE cp.id::text = $1
        AND cp.jurisdiction_id = $2
        AND cp.process_type_id = $3
        AND COALESCE(cp.realized, false) = false
        AND EXISTS (
          SELECT 1
            FROM civic_process_source_records signature_source
           WHERE signature_source.civic_process_id = cp.id
             AND signature_source.source_id = $4
             AND signature_source.source_stage = ANY($5::text[])
             AND COALESCE(signature_source.payload_metadata->>'signatures', '') ~ '^[0-9]+$'
             AND (signature_source.payload_metadata->>'signatures')::int >= $6
             AND COALESCE((signature_source.payload_metadata->>'quorumReached')::boolean, false) = true
        )
      LIMIT 1`,
    [id, IT_JURISDICTION, IT_POPULAR_INITIATIVE, SIGNATURE_SOURCE, PRIORITY_SOURCE_STAGES, threshold]
  );
  return result.rows[0] || null;
}

async function getCurrentPopularInitiativeVote(poolOrClient, userId) {
  if (!userId) return null;
  const result = await poolOrClient.query(
    `SELECT iniziativa_id, timestamp, created_at
       FROM voti_iniziative_popolari
      WHERE userid::text = $1
      ORDER BY timestamp DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1`,
    [String(userId)]
  );
  return result.rows[0] || null;
}

async function getCurrentEligiblePopularInitiativeVote(poolOrClient, userId) {
  const vote = await getCurrentPopularInitiativeVote(poolOrClient, userId);
  if (!vote) return null;
  const eligible = await getPriorityEligiblePopularInitiative(poolOrClient, vote.iniziativa_id);
  return eligible ? vote : null;
}

module.exports = {
  IT_POPULAR_INITIATIVE,
  IT_JURISDICTION,
  SIGNATURE_SOURCE,
  PRIORITY_SOURCE_STAGES,
  PARLIAMENT_SOURCES,
  isMissingCivicSchemaError,
  mapCanonicalPriorityRow,
  getPrioritySourceStatus,
  listPriorityEligiblePopularInitiatives,
  getPriorityEligiblePopularInitiative,
  getCurrentPopularInitiativeVote,
  getCurrentEligiblePopularInitiativeVote,
};
