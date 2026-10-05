const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_RESEARCH_POLITICAL_VECTOR_ROWS,
  MAX_RESEARCH_POLITICAL_OPINIONS_PER_ROW,
  MAX_RESEARCH_OPINION_VECTOR_ENTRIES,
  MAX_RESEARCH_POLITICAL_VECTOR_RESPONSE_BYTES,
  MAX_RESEARCH_OPINION_VECTOR_RESPONSE_BYTES,
  buildResearchPoliticalVectorsPublicResponse,
  buildResearchOpinionVectorPublicResponse
} = require('../services/researchPublicVectorResponsePolicy');

const candidate = (overrides = {}) => ({
  candidateId: 'candidate-1',
  displayName: 'Candidate One',
  avatarConfig: { seed: 'safe-avatar' },
  opinions: { 'q-1': 'f', 'q-2': 'i' },
  internalEmail: 'must-not-emerge@example.invalid',
  ...overrides
});

const largeOpinionObject = (count, questionLength = 16) => Object.fromEntries(
  Array.from({ length: count }, (_, index) => {
    const prefix = `q${index}-`;
    return [(prefix + 'x'.repeat(questionLength)).slice(0, 128), index % 2 === 0 ? 'f' : 'c'];
  })
);

test('Research political vector response emits only exact public fields and is byte bounded', () => {
  const response = buildResearchPoliticalVectorsPublicResponse([candidate()]);
  assert.deepEqual(Object.keys(response), ['candidates']);
  assert.deepEqual(Object.keys(response.candidates[0]), ['candidateId', 'displayName', 'avatarConfig', 'opinions']);
  assert.equal('internalEmail' in response.candidates[0], false);
  assert.equal(Object.isFrozen(response), true);
  assert.equal(Object.isFrozen(response.candidates), true);
  assert.ok(Buffer.byteLength(JSON.stringify(response), 'utf8') <= MAX_RESEARCH_POLITICAL_VECTOR_RESPONSE_BYTES);
});

test('Research political vector response rejects row and per-candidate opinion explosions', () => {
  assert.throws(
    () => buildResearchPoliticalVectorsPublicResponse(
      Array.from({ length: MAX_RESEARCH_POLITICAL_VECTOR_ROWS + 1 }, (_, index) => candidate({ candidateId: `c-${index}` }))
    ),
    /political vector rows/
  );
  assert.throws(
    () => buildResearchPoliticalVectorsPublicResponse([
      candidate({ opinions: largeOpinionObject(MAX_RESEARCH_POLITICAL_OPINIONS_PER_ROW + 1) })
    ]),
    /entry limit/
  );
});

test('Research political vector response rejects oversized or malformed nested public data', () => {
  assert.throws(
    () => buildResearchPoliticalVectorsPublicResponse([
      candidate({ avatarConfig: { payload: 'x'.repeat(9 * 1024) } })
    ]),
    /avatar config/
  );
  assert.throws(
    () => buildResearchPoliticalVectorsPublicResponse([
      candidate({ opinions: { 'q-1': 'f', secret: 'unexpected-answer' } })
    ]),
    /opinion entry/
  );
  assert.throws(
    () => buildResearchPoliticalVectorsPublicResponse([
      candidate({ displayName: 'x'.repeat(600) })
    ]),
    /display name/
  );
});

test('Research opinion-vector response is exact, frozen and bounded', () => {
  const response = buildResearchOpinionVectorPublicResponse({
    opinions: { 'q-privacy': 'f', 'q-2': 'i' },
    participantId: 'must-not-emerge'
  });
  assert.deepEqual(response, { opinions: { 'q-privacy': 'f', 'q-2': 'i' } });
  assert.deepEqual(Object.keys(response), ['opinions']);
  assert.equal(Object.isFrozen(response), true);
  assert.equal(Object.isFrozen(response.opinions), true);
  assert.ok(Buffer.byteLength(JSON.stringify(response), 'utf8') <= MAX_RESEARCH_OPINION_VECTOR_RESPONSE_BYTES);
});

test('Research opinion-vector response rejects entry-count and encoded-size explosions', () => {
  assert.throws(
    () => buildResearchOpinionVectorPublicResponse({
      opinions: largeOpinionObject(MAX_RESEARCH_OPINION_VECTOR_ENTRIES + 1)
    }),
    /entry limit/
  );

  const maximumCountWithLongIds = Object.fromEntries(
    Array.from({ length: MAX_RESEARCH_OPINION_VECTOR_ENTRIES }, (_, index) => {
      const prefix = `q${index}-`;
      return [(prefix + 'x'.repeat(128)).slice(0, 128), 'f'];
    })
  );
  assert.throws(
    () => buildResearchOpinionVectorPublicResponse({ opinions: maximumCountWithLongIds }),
    /response size limit/
  );
});

test('Research public opinion maps reject dangerous object keys and control characters', () => {
  const dangerous = JSON.parse('{"__proto__":"f"}');
  assert.throws(
    () => buildResearchOpinionVectorPublicResponse({ opinions: dangerous }),
    /opinion entry/
  );
  assert.throws(
    () => buildResearchOpinionVectorPublicResponse({ opinions: { 'q\nsecret': 'f' } }),
    /question id/
  );
});
