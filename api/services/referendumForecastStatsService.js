'use strict';

const { decompressRegione } = require('../utils/regioniUtils');
const { decompressProvince } = require('../utils/provinceUtils');

const MIN_PUBLIC_RESPONSES = 10;

function round1(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value) * 10) / 10;
}

function buildForecastStats(row) {
  const total = Number(row.total_responses || 0);
  const yes = Number(row.yes_count || 0);
  const no = Number(row.no_count || 0);
  const abstain = Number(row.abstain_count || 0);
  const intendingVoters = yes + no;

  if (total < MIN_PUBLIC_RESPONSES) {
    return {
      suppressed: true,
      minimumResponses: MIN_PUBLIC_RESPONSES,
      totalResponses: total,
    };
  }

  const turnout = total > 0 ? (intendingVoters / total) * 100 : null;
  const yesPercent = intendingVoters > 0 ? (yes / intendingVoters) * 100 : null;
  const noPercent = intendingVoters > 0 ? (no / intendingVoters) * 100 : null;
  const abstainPercent = total > 0 ? (abstain / total) * 100 : null;
  const quorumThreshold = row.quorum_threshold == null ? null : Number(row.quorum_threshold) * 100;

  let quorum = { kind: row.quorum_kind, required: false, thresholdPercent: null, forecastReached: null };
  if (row.quorum_kind === 'turnout_threshold') {
    quorum = {
      kind: row.quorum_kind,
      required: true,
      thresholdPercent: round1(quorumThreshold),
      forecastReached: turnout == null || quorumThreshold == null ? null : turnout >= quorumThreshold,
    };
  } else if (row.quorum_kind === 'custom') {
    quorum = { kind: row.quorum_kind, required: true, thresholdPercent: null, forecastReached: null };
  }

  return {
    suppressed: false,
    minimumResponses: MIN_PUBLIC_RESPONSES,
    totalResponses: total,
    intendingVoters,
    yesCount: yes,
    noCount: no,
    abstainCount: abstain,
    turnoutPercent: round1(turnout),
    yesPercent: round1(yesPercent),
    noPercent: round1(noPercent),
    abstainPercent: round1(abstainPercent),
    quorum,
  };
}

function labelRegion(value) {
  if (!value) return null;
  return decompressRegione(value) || String(value);
}

function labelProvince(value) {
  if (!value) return null;
  return decompressProvince(value) || String(value);
}

function mapGeographicRow(row, level) {
  const mapped = {
    level,
    region: labelRegion(row.regione_residenza),
    province: level === 'province' || level === 'municipality' ? labelProvince(row.provincia_residenza) : null,
    municipality: level === 'municipality' ? (row.comune_residenza || null) : null,
    forecast: buildForecastStats(row),
  };
  return mapped;
}

async function loadGeographicForecast(pool, ballotId) {
  const ballot = await pool.query(
    `SELECT id, quorum_kind, quorum_threshold
       FROM civic_ballots
      WHERE id::text = $1
      LIMIT 1`,
    [String(ballotId)],
  );
  if (!ballot.rows[0]) return null;

  const baseParams = [String(ballotId), MIN_PUBLIC_RESPONSES];
  const consentPredicate = `COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE`;
  const baseFrom = `
    FROM civic_ballot_positions p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN user_consents uc ON uc.user_id = u.id
    WHERE p.civic_ballot_id::text = $1
      AND ${consentPredicate}
      AND COALESCE(u.paese_residenza, 'it') = 'it'`;
  const counts = `
    COUNT(*)::int AS total_responses,
    COUNT(*) FILTER (WHERE p.choice = 'YES')::int AS yes_count,
    COUNT(*) FILTER (WHERE p.choice = 'NO')::int AS no_count,
    COUNT(*) FILTER (WHERE p.choice = 'ABSTAIN')::int AS abstain_count`;

  const [regions, provinces, municipalities] = await Promise.all([
    pool.query(
      `SELECT u.regione_residenza, NULL::text AS provincia_residenza, NULL::text AS comune_residenza,
              ${counts}
         ${baseFrom}
        AND u.regione_residenza IS NOT NULL
        GROUP BY u.regione_residenza
        HAVING COUNT(*) >= $2
        ORDER BY COUNT(*) DESC, u.regione_residenza ASC`,
      baseParams,
    ),
    pool.query(
      `SELECT u.regione_residenza, u.provincia_residenza, NULL::text AS comune_residenza,
              ${counts}
         ${baseFrom}
        AND u.regione_residenza IS NOT NULL
        AND u.provincia_residenza IS NOT NULL
        GROUP BY u.regione_residenza, u.provincia_residenza
        HAVING COUNT(*) >= $2
        ORDER BY COUNT(*) DESC, u.regione_residenza ASC, u.provincia_residenza ASC`,
      baseParams,
    ),
    pool.query(
      `SELECT u.regione_residenza, u.provincia_residenza, u.comune_residenza,
              ${counts}
         ${baseFrom}
        AND u.regione_residenza IS NOT NULL
        AND u.provincia_residenza IS NOT NULL
        AND NULLIF(TRIM(u.comune_residenza), '') IS NOT NULL
        GROUP BY u.regione_residenza, u.provincia_residenza, u.comune_residenza
        HAVING COUNT(*) >= $2
        ORDER BY COUNT(*) DESC, u.regione_residenza ASC, u.provincia_residenza ASC, u.comune_residenza ASC`,
      baseParams,
    ),
  ]);

  const quorum = ballot.rows[0];
  const withQuorum = (row) => ({
    ...row,
    quorum_kind: quorum.quorum_kind,
    quorum_threshold: quorum.quorum_threshold,
  });

  return {
    minimumResponses: MIN_PUBLIC_RESPONSES,
    regions: regions.rows.map((row) => mapGeographicRow(withQuorum(row), 'region')),
    provinces: provinces.rows.map((row) => mapGeographicRow(withQuorum(row), 'province')),
    municipalities: municipalities.rows.map((row) => mapGeographicRow(withQuorum(row), 'municipality')),
  };
}

async function loadForecastTrend(pool, ballotId) {
  const result = await pool.query(
    `SELECT
       s.bucket_start,
       s.total_responses,
       s.yes_count,
       s.no_count,
       s.abstain_count,
       s.is_frozen,
       cb.quorum_kind,
       cb.quorum_threshold
     FROM civic_ballot_forecast_snapshots s
     JOIN civic_ballots cb ON cb.id = s.civic_ballot_id
     WHERE s.civic_ballot_id::text = $1
     ORDER BY s.bucket_start ASC`,
    [String(ballotId)],
  );

  return result.rows.map((row) => ({
    at: row.bucket_start,
    isFrozen: row.is_frozen === true,
    forecast: buildForecastStats(row),
  }));
}

async function loadRecentReferendumHistory(pool, { limit = 10, lookbackDays = 730 } = {}) {
  const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(limit), 10) || 10));
  const safeDays = Math.max(30, Math.min(3650, Number.parseInt(String(lookbackDays), 10) || 730));
  const result = await pool.query(
    `SELECT
       cb.id,
       cb.civic_process_id,
       cb.ballot_kind,
       cb.question_text,
       cb.yes_meaning,
       cb.no_meaning,
       cb.opens_at,
       cb.closes_at,
       cb.timezone,
       cb.quorum_kind,
       cb.quorum_threshold,
       cb.status,
       cb.source_id,
       cb.source_url,
       cb.official_reference,
       cb.official_turnout_percent,
       cb.official_yes_percent,
       cb.official_no_percent,
       cb.official_result_updated_at,
       cp.canonical_title,
       cp.canonical_url,
       frozen.bucket_start AS frozen_snapshot_at,
       COALESCE(frozen.total_responses, current_counts.total_responses, 0)::int AS total_responses,
       COALESCE(frozen.yes_count, current_counts.yes_count, 0)::int AS yes_count,
       COALESCE(frozen.no_count, current_counts.no_count, 0)::int AS no_count,
       COALESCE(frozen.abstain_count, current_counts.abstain_count, 0)::int AS abstain_count
     FROM civic_ballots cb
     JOIN civic_processes cp ON cp.id = cb.civic_process_id
     LEFT JOIN LATERAL (
       SELECT s.*
       FROM civic_ballot_forecast_snapshots s
       WHERE s.civic_ballot_id = cb.id
         AND s.is_frozen = TRUE
       ORDER BY s.bucket_start ASC
       LIMIT 1
     ) frozen ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         COUNT(p.user_id)::int AS total_responses,
         COUNT(p.user_id) FILTER (WHERE p.choice = 'YES')::int AS yes_count,
         COUNT(p.user_id) FILTER (WHERE p.choice = 'NO')::int AS no_count,
         COUNT(p.user_id) FILTER (WHERE p.choice = 'ABSTAIN')::int AS abstain_count
       FROM civic_ballot_positions p
       WHERE p.civic_ballot_id = cb.id
     ) current_counts ON TRUE
     WHERE cb.opens_at <= NOW()
       AND cb.opens_at >= NOW() - ($1::int * INTERVAL '1 day')
       AND cb.status <> 'cancelled'
     ORDER BY cb.opens_at DESC, cp.canonical_title ASC
     LIMIT $2`,
    [safeDays, safeLimit],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    civicProcessId: String(row.civic_process_id),
    title: row.canonical_title,
    ballotKind: row.ballot_kind,
    question: row.question_text,
    yesMeaning: row.yes_meaning,
    noMeaning: row.no_meaning,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    timezone: row.timezone,
    source: {
      id: row.source_id,
      url: row.source_url,
      officialReference: row.official_reference || null,
      canonicalUrl: row.canonical_url || null,
    },
    forecastFrozenAt: row.frozen_snapshot_at || row.opens_at,
    forecast: buildForecastStats(row),
    officialResult: row.official_result_updated_at
      ? {
          turnoutPercent: row.official_turnout_percent == null ? null : Number(row.official_turnout_percent),
          yesPercent: row.official_yes_percent == null ? null : Number(row.official_yes_percent),
          noPercent: row.official_no_percent == null ? null : Number(row.official_no_percent),
          updatedAt: row.official_result_updated_at,
        }
      : null,
  }));
}

module.exports = {
  MIN_PUBLIC_RESPONSES,
  round1,
  buildForecastStats,
  loadGeographicForecast,
  loadForecastTrend,
  loadRecentReferendumHistory,
};
