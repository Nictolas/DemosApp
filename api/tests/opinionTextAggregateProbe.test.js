'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTextAggregateQuery } = require('../utils/opinionTextAggregateProbe');

test('rejects invalid identifiers, duplicates and empty catalog', () => {
  for (const ids of [[], ['q0','q0'], ['q0"; DROP TABLE users;--'], [null], ['A'], ['a-b']]) {
    assert.throws(() => buildTextAggregateQuery(ids));
  }
});
test('produces a single grouped query preserving consent and PERSON filters', () => {
  const sql = buildTextAggregateQuery(['synthetic_opinion_000','synthetic_opinion_001']);
  assert.match(sql, /CROSS JOIN LATERAL \(VALUES/);
  assert.match(sql, /"synthetic_opinion_000"/);
  assert.match(sql, /"synthetic_opinion_001"/);
  assert.match(sql, /GROUP BY v\.opinion_id/);
  assert.match(sql, /u\.account_type = 'PERSON'/);
  assert.match(sql, /COALESCE\(uc\.political_opinions_consent,/);
  assert.doesNotMatch(sql, /AND u\.region = \$1/);
  assert.match(buildTextAggregateQuery(['q0'],{region:true}), /AND u\.region = \$1/);
});
