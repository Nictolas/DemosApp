'use strict';

const APPROVED_BALLOT_SOURCES = Object.freeze([
  'it.official_gazette',
  'it.interior.eligendo',
]);

function isMissingSchema(error) {
  return Boolean(error && error.code === '42P01');
}

function asText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeThreshold(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number > 1 ? number / 100 : number;
}

function normalizeBallotMetadata(row) {
  const metadata = row.payload_metadata && typeof row.payload_metadata === 'object'
    ? row.payload_metadata
    : {};
  const ballot = metadata.ballot && typeof metadata.ballot === 'object' ? metadata.ballot : null;
  if (!ballot) return null;

  const opensAt = asDate(ballot.opensAt || ballot.opens_at);
  const closesAt = asDate(ballot.closesAt || ballot.closes_at);
  const question = asText(ballot.question || ballot.questionText || ballot.question_text);
  const yesMeaning = asText(ballot.yesMeaning || ballot.yes_meaning);
  const noMeaning = asText(ballot.noMeaning || ballot.no_meaning);
  const kind = asText(ballot.kind || ballot.ballotKind || ballot.ballot_kind);
  const timezone = asText(ballot.timezone) || 'Europe/Rome';
  const status = asText(ballot.status) || 'scheduled';
  const quorumKind = asText(ballot.quorumKind || ballot.quorum_kind) || 'none';
  const quorumThreshold = normalizeThreshold(ballot.quorumThreshold ?? ballot.quorum_threshold);

  if (!opensAt || !closesAt || closesAt <= opensAt || !question || !yesMeaning || !noMeaning || !kind) {
    return null;
  }
  if (!['scheduled', 'postponed', 'cancelled', 'closed'].includes(status)) return null;
  if (!['none', 'turnout_threshold', 'custom'].includes(quorumKind)) return null;
  if (quorumKind === 'turnout_threshold' && (!quorumThreshold || quorumThreshold > 1)) return null;

  const officialResult = ballot.officialResult && typeof ballot.officialResult === 'object'
    ? ballot.officialResult
    : null;

  return {
    kind,
    question,
    yesMeaning,
    noMeaning,
    opensAt,
    closesAt,
    timezone,
    status,
    quorumKind,
    quorumThreshold,
    officialTurnout: officialResult?.turnoutPercent ?? null,
    officialYes: officialResult?.yesPercent ?? null,
    officialNo: officialResult?.noPercent ?? null,
    officialUpdatedAt: asDate(officialResult?.updatedAt),
  };
}

async function syncReferendumBallotsFromCanonicalSources({ pool }) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (sr.civic_process_id)
         sr.civic_process_id,
         sr.source_id,
         sr.source_url,
         sr.official_reference,
         sr.payload_metadata,
         sr.status_updated_at,
         sr.last_seen_at
       FROM civic_process_source_records sr
       JOIN civic_processes cp ON cp.id = sr.civic_process_id
       WHERE cp.process_type_id = 'it.referendum_signature_request'
         AND sr.source_id = ANY($1::text[])
         AND sr.payload_metadata ? 'ballot'
       ORDER BY sr.civic_process_id,
         CASE WHEN sr.source_id = 'it.interior.eligendo' THEN 0 ELSE 1 END,
         sr.status_updated_at DESC NULLS LAST,
         sr.last_seen_at DESC`,
      [APPROVED_BALLOT_SOURCES],
    );

    let ingested = 0;
    let skipped = 0;
    const errors = [];

    for (const row of result.rows) {
      const ballot = normalizeBallotMetadata(row);
      if (!ballot || !asText(row.source_url)) {
        skipped += 1;
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO civic_ballots (
             civic_process_id, ballot_kind, question_text, yes_meaning, no_meaning,
             opens_at, closes_at, timezone, quorum_kind, quorum_threshold, status,
             source_id, source_url, official_reference,
             official_turnout_percent, official_yes_percent, official_no_percent,
             official_result_updated_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10, $11,
             $12, $13, $14,
             $15, $16, $17, $18, NOW()
           )
           ON CONFLICT (civic_process_id)
           DO UPDATE SET
             ballot_kind = EXCLUDED.ballot_kind,
             question_text = EXCLUDED.question_text,
             yes_meaning = EXCLUDED.yes_meaning,
             no_meaning = EXCLUDED.no_meaning,
             opens_at = EXCLUDED.opens_at,
             closes_at = EXCLUDED.closes_at,
             timezone = EXCLUDED.timezone,
             quorum_kind = EXCLUDED.quorum_kind,
             quorum_threshold = EXCLUDED.quorum_threshold,
             status = EXCLUDED.status,
             source_id = EXCLUDED.source_id,
             source_url = EXCLUDED.source_url,
             official_reference = EXCLUDED.official_reference,
             official_turnout_percent = EXCLUDED.official_turnout_percent,
             official_yes_percent = EXCLUDED.official_yes_percent,
             official_no_percent = EXCLUDED.official_no_percent,
             official_result_updated_at = EXCLUDED.official_result_updated_at,
             updated_at = NOW()`,
          [
            row.civic_process_id,
            ballot.kind,
            ballot.question,
            ballot.yesMeaning,
            ballot.noMeaning,
            ballot.opensAt.toISOString(),
            ballot.closesAt.toISOString(),
            ballot.timezone,
            ballot.quorumKind,
            ballot.quorumThreshold,
            ballot.status,
            row.source_id,
            row.source_url,
            row.official_reference || null,
            ballot.officialTurnout,
            ballot.officialYes,
            ballot.officialNo,
            ballot.officialUpdatedAt?.toISOString() || null,
          ],
        );
        ingested += 1;
      } catch (error) {
        errors.push({ civicProcessId: row.civic_process_id, error: error.message });
      }
    }

    return {
      schemaReady: true,
      fetched: result.rows.length,
      ingested,
      skipped,
      errors,
    };
  } catch (error) {
    if (isMissingSchema(error)) {
      return {
        schemaReady: false,
        fetched: 0,
        ingested: 0,
        skipped: 0,
        errors: [],
        reason: 'REFERENDUM_BALLOT_MIGRATION_REQUIRED',
      };
    }
    throw error;
  }
}

module.exports = {
  APPROVED_BALLOT_SOURCES,
  normalizeBallotMetadata,
  syncReferendumBallotsFromCanonicalSources,
};
