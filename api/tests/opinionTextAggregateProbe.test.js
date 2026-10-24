'use strict';
// Synthetic-only comparison plan for TEXT query optimization. No DB connection,
// no schema changes and no production endpoint modifications.
const assert = require('node:assert/strict');
const test = require('node:test');

function quoteIdentifier(id) {
  if (typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id)) throw Error('Invalid opinion column');
  return '"' + id + '"';
}
function buildAggregateSQL(ids) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw Error('Invalid catalog');
  const columns = ids.map(quoteIdentifier);
  const selects = columns.map((col, i) => {
    const id = ids[i].replace(/'/g, "''");
    return `SELECT '${id}'::text AS opinion_id, COUNT(*) FILTER (WHERE v = 'f')::bigint AS favorevole, COUNT(*) FILTER (WHERE v = 'c')::bigint AS contrario, COUNT(*) FILTER (WHERE v = 'i')::bigint AS indeciso FROM eligible CROSS JOIN LATERAL (SELECT ${col} AS v) x WHERE v IS NOT NULL`;
  });
  return `WITH eligible AS MATERIALIZED (
SELECT orr.* FROM opinioni_risposte orr
JOIN users u ON u.id = orr.user_id
LEFT JOIN user_consents uc ON uc.user_id = u.id
WHERE u.account_type = 'PERSON'
AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
)
${selects.join('\nUNION ALL\n')}`;
}
test('rejects unsafe, empty or duplicate opinion IDs', () => {
  for (const ids of [[], ['x','x'], ['x";DROP TABLE users;--'], [null]]) {
    assert.throws(() => buildAggregateSQL(ids));
  }
});
test('preserves PERSON and consent predicates and every opinion', () => {
  const sql = buildAggregateSQL(['caccia','nato']);
  assert.match(sql, /account_type = 'PERSON'/);
  assert.match(sql, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
  assert.match(sql, /"caccia"/);
  assert.match(sql, /"nato"/);
  assert.match(sql, /MATERIALIZED/);
});
module.exports = { buildAggregateSQL };
