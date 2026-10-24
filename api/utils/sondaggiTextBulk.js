'use strict';

/**
 * National survey aggregates using the current TEXT answer columns.
 * This is NOT a binary codec, migration or new API response.
 *
 * The published question list is supplied by the existing /api/sondaggi
 * route. Before interpolating any column into SQL, validate its identifier
 * and require an exact match in public.opinioni_risposte metadata.
 */
const { cellThresholdMet } = require('./politicalAggregatePrivacy');

const SAFE_COLUMN = /^[a-z][a-z0-9_]{0,62}$/;
const MAX_GROUPED_COLUMNS = 256;
const COLUMN_SQL = `
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'opinioni_risposte'
    AND column_name = ANY($1::text[])
`;

function safeOpinionIds(questions) {
  if (!Array.isArray(questions)) throw new TypeError('Expected question array');
  return [...new Set(questions.map(q => q?.id).filter(
    id => typeof id === 'string' && SAFE_COLUMN.test(id)
  ))];
}

function aggregateRow(row) {
  return {
    favorevole: Number.parseInt(row.favorevole, 10) || 0,
    contrario: Number.parseInt(row.contrario, 10) || 0,
    indeciso: Number.parseInt(row.indeciso, 10) || 0
  };
}

function asPublishedStats(rows) {
  const stats = {};
  for (const row of rows) {
    const aggregate = aggregateRow(row);
    if (cellThresholdMet(aggregate)) {
      stats[row.opinion_id] = aggregate;
    }
  }
  return stats;
}

function buildNationalTextAggregateQuery(columns) {
  if (!Array.isArray(columns) || columns.length === 0 ||
      columns.length > MAX_GROUPED_COLUMNS ||
      new Set(columns).size !== columns.length ||
      columns.some(id => typeof id !== 'string' || !SAFE_COLUMN.test(id))) {
    throw new TypeError('Expected unique validated opinion columns');
  }
  const values = columns.map(id => "('" + id + "', orr.\"" + id + "\")").join(',\n    ');
  return `
    SELECT v.opinion_id,
      COUNT(*) FILTER (WHERE v.answer = 'f')::int AS favorevole,
      COUNT(*) FILTER (WHERE v.answer = 'c')::int AS contrario,
      COUNT(*) FILTER (WHERE v.answer = 'i')::int AS indeciso
    FROM opinioni_risposte orr
    JOIN users u ON u.id = orr.user_id
    LEFT JOIN user_consents uc ON uc.user_id = u.id
    CROSS JOIN LATERAL (VALUES
      ${values}
    ) AS v(opinion_id, answer)
    WHERE v.answer IS NOT NULL
      AND u.account_type = 'PERSON'
      AND COALESCE(uc.political_opinions_consent,
                   u.political_opinions_consent, false) IS TRUE
    GROUP BY v.opinion_id
  `;
}

async function legacyNationalStatsFallback(pool, ids) {
  const stats = {};
  for (const id of ids) {
    try {
      const allowed = await pool.query(COLUMN_SQL, [[id]]);
      if (!allowed.rows.some(row => row.column_name === id)) continue;
      const quoted = '"' + id + '"';
      const result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE orr.${quoted} = 'f') AS favorevole,
          COUNT(*) FILTER (WHERE orr.${quoted} = 'c') AS contrario,
          COUNT(*) FILTER (WHERE orr.${quoted} = 'i') AS indeciso
        FROM opinioni_risposte orr
        JOIN users u ON u.id = orr.user_id
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE orr.${quoted} IS NOT NULL
          AND u.account_type = 'PERSON'
          AND COALESCE(uc.political_opinions_consent,
                       u.political_opinions_consent, false) IS TRUE
      `);
      const aggregate = aggregateRow(result.rows[0] || {});
      if (cellThresholdMet(aggregate)) stats[id] = aggregate;
    } catch (error) {
      // Same best-effort per-question behavior as the old national route:
      // a failed column should not reveal partial/under-threshold counts.
      continue;
    }
  }
  return stats;
}

async function getNationalSurveyStats(pool, questions, logger = console) {
  const ids = safeOpinionIds(questions);
  if (ids.length === 0) return {};
  try {
    // Very large catalogs take the established, bounded-column fallback
    // rather than constructing an unbounded VALUES list.
    if (ids.length > MAX_GROUPED_COLUMNS) {
      return legacyNationalStatsFallback(pool, ids);
    }
    const metadata = await pool.query(COLUMN_SQL, [ids]);
    const existing = new Set(metadata.rows.map(row => row.column_name));
    const columns = ids.filter(id => existing.has(id));
    if (columns.length === 0) return {};
    const result = await pool.query(buildNationalTextAggregateQuery(columns));
    return asPublishedStats(result.rows.filter(row => existing.has(row.opinion_id)));
  } catch (error) {
    logger.warn?.('National TEXT survey aggregation unavailable; using legacy per-opinion queries', error.message);
    return legacyNationalStatsFallback(pool, ids);
  }
}

module.exports = {
  safeOpinionIds,
  buildNationalTextAggregateQuery,
  getNationalSurveyStats
};
