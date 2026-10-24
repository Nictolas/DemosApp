'use strict';

/**
 * Isolated TEXT aggregation experiment, NOT wired to /api/sondaggi.
 * One SQL query over eligible PERSON accounts and 94 answer columns.
 * The input is a trusted, versioned catalog of SQL column identifiers.
 */
function buildTextAggregateQuery(columns, { region = false } = {}) {
  if (!Array.isArray(columns) || columns.length === 0 ||
      new Set(columns).size !== columns.length ||
      columns.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id))) {
    throw new TypeError('Expected distinct safe opinion column names');
  }
  const tuples = columns.map(id => "('" + id + "', r.\"" + id + "\")").join(',\n    ');
  return `SELECT v.opinion_id,
  COUNT(*) FILTER (WHERE v.answer = 'f')::int AS favorevole,
  COUNT(*) FILTER (WHERE v.answer = 'c')::int AS contrario,
  COUNT(*) FILTER (WHERE v.answer = 'i')::int AS indeciso
FROM ci_query_text r
JOIN ci_opt_users u ON u.id = r.user_id
LEFT JOIN ci_opt_consents uc ON uc.user_id = u.id
CROSS JOIN LATERAL (VALUES
    ${tuples}
) AS v(opinion_id, answer)
WHERE u.account_type = 'PERSON'
  AND COALESCE(uc.political_opinions_consent,
               u.political_opinions_consent, false) IS TRUE
  ${region ? "AND u.region = $1" : ''}
  AND v.answer IS NOT NULL
GROUP BY v.opinion_id`;
}
module.exports = { buildTextAggregateQuery };
