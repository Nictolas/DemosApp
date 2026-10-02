const test = require('node:test');
const assert = require('node:assert/strict');
const { READ_ELIGIBLE_POLITICAL_VECTORS_SQL, createResearchPoliticalVectorAdapter } = require('../services/researchPoliticalVectorAdapter');

test('political vector adapter queries only the Research projection and parameterizes scope', async () => {
  let received;
  const reader = createResearchPoliticalVectorAdapter({ client: { query: async (sql, params) => {
    received = { sql, params };
    return { rows: [{ candidate_id: 'c1', display_name: 'Candidate', avatar_config: null, opinions: { q1: 2 } }] };
  } } });
  const result = await reader.read({ kind: 'candidate', grade: 'E', country: 'IT' });
  assert.match(READ_ELIGIBLE_POLITICAL_VECTORS_SQL, /research_public_political_vectors/);
  assert.doesNotMatch(READ_ELIGIBLE_POLITICAL_VECTORS_SQL, /\busers\b|opinioni_risposte|user_id/i);
  assert.deepEqual(received.params, ['candidate', 'E', 'IT', null, null, null]);
  assert.equal(result[0].candidateId, 'c1');
});

test('political vector adapter has no identity selector parameter', async () => {
  const reader = createResearchPoliticalVectorAdapter({ client: { query: async (_sql, params) => {
    assert.equal(params.includes('citizen-123'), false);
    return { rows: [] };
  } } });
  await assert.rejects(() => reader.read({ kind: 'candidate', grade: 'E', userId: 'citizen-123' }));
});
