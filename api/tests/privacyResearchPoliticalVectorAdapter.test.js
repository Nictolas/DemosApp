const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESEARCH_POLITICAL_VECTOR_OVERFLOW_LIMIT,
  READ_ELIGIBLE_POLITICAL_VECTORS_SQL,
  createResearchPoliticalVectorAdapter
} = require('../services/researchPoliticalVectorAdapter');
const {
  MAX_RESEARCH_POLITICAL_VECTOR_ROWS
} = require('../services/researchPublicVectorResponsePolicy');

test('political vector adapter queries only the Research projection and parameterizes bounded scope', async () => {
  let received;
  const reader = createResearchPoliticalVectorAdapter({ client: { query: async (sql, params) => {
    received = { sql, params };
    return { rows: [{ candidate_id: 'c1', display_name: 'Candidate', avatar_config: null, opinions: { q1: 'f' } }] };
  } } });
  const result = await reader.read({ kind: 'candidate', grade: 'E', country: 'IT' });
  assert.match(READ_ELIGIBLE_POLITICAL_VECTORS_SQL, /research_public_political_vectors/);
  assert.doesNotMatch(READ_ELIGIBLE_POLITICAL_VECTORS_SQL, /\busers\b|opinioni_risposte|user_id/i);
  assert.match(received.sql, /LIMIT\s+\$7/i);
  assert.deepEqual(received.params, [
    'candidate', 'E', 'IT', null, null, null, RESEARCH_POLITICAL_VECTOR_OVERFLOW_LIMIT
  ]);
  assert.equal(RESEARCH_POLITICAL_VECTOR_OVERFLOW_LIMIT, MAX_RESEARCH_POLITICAL_VECTOR_ROWS + 1);
  assert.equal(result[0].candidateId, 'c1');
});

test('political vector adapter fails closed instead of silently truncating an oversized scope', async () => {
  const rows = Array.from({ length: RESEARCH_POLITICAL_VECTOR_OVERFLOW_LIMIT }, (_, index) => ({
    candidate_id: 'c' + index,
    display_name: 'Candidate ' + index,
    avatar_config: null,
    opinions: {}
  }));
  const reader = createResearchPoliticalVectorAdapter({ client: { query: async () => ({ rows }) } });
  await assert.rejects(
    () => reader.read({ kind: 'candidate', grade: 'E', country: 'IT' }),
    /exceeds read row limit/
  );
});

test('political vector adapter has no identity selector parameter', async () => {
  const reader = createResearchPoliticalVectorAdapter({ client: { query: async (_sql, params) => {
    assert.equal(params.includes('citizen-123'), false);
    return { rows: [] };
  } } });
  await assert.rejects(() => reader.read({ kind: 'candidate', grade: 'E', userId: 'citizen-123' }));
});
