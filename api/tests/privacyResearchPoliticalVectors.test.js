const test = require('node:test');
const assert = require('node:assert/strict');
const { assertResearchPublicPayload, RESEARCH_PUBLIC_ENDPOINTS } = require('../services/researchPublicApiContract');
const { normalizePoliticalVectorScope, createResearchPoliticalVectorReader } = require('../services/researchPoliticalVectorReader');

test('political vector public request forbids identity and citizen opinion payloads', () => {
  assert.equal(assertResearchPublicPayload({ scope: { kind: 'candidate', grade: 'E' } }, RESEARCH_PUBLIC_ENDPOINTS.listPoliticalVectors.requestKeys), true);
  for (const payload of [
    { userId: '123', scope: {} },
    { opinions: { q1: 2 }, scope: {} },
    { citizenOpinions: { q1: 2 }, scope: {} }
  ]) assert.throws(() => assertResearchPublicPayload(payload, RESEARCH_PUBLIC_ENDPOINTS.listPoliticalVectors.requestKeys));
});

test('political vector scope is allowlisted and contains no identity selector', () => {
  assert.deepEqual(normalizePoliticalVectorScope({ kind: 'candidate', grade: 'CO', municipality: 'Pisa' }), { kind: 'candidate', grade: 'CO', municipality: 'Pisa' });
  assert.throws(() => normalizePoliticalVectorScope({ kind: 'candidate', grade: 'CO', userId: '123' }));
});

test('political vector reader returns only minimized candidate metadata and opinions', async () => {
  const reader = createResearchPoliticalVectorReader({ readEligibleVectors: async () => [{ candidateId: 7, displayName: 'Ada B', avatarConfig: null, opinions: { q1: 2 }, email: 'hidden@example.test' }] });
  const rows = await reader.read({ kind: 'representative', grade: 'R', region: 'Toscana' });
  assert.deepEqual(rows, [{ candidateId: '7', displayName: 'Ada B', avatarConfig: null, opinions: { q1: 2 } }]);
  assert.equal('email' in rows[0], false);
});
