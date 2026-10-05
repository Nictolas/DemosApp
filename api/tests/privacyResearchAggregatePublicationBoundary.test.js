const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_PUBLISHED_AGGREGATE_ROWS,
  publishResearchAggregateCell,
  publishResearchAggregateRows
} = require('../services/researchAggregatePublicationPolicy');
const {
  buildResearchAggregateMethodology
} = require('../services/researchAggregateMethodology');

const publishOne = (participantCount, extra = {}) => publishResearchAggregateRows([
  {
    answer_code: 'f',
    participant_count: String(participantCount),
    participant_id: 'internal-participant',
    question_id: 'internal-question',
    recorded_at: '2026-10-05T12:00:00Z',
    extra: 'internal-extra',
    ...extra
  }
], { minimumCellSize: 5 });

test('sub-threshold aggregate counts are publication-indistinguishable', () => {
  const countOne = publishOne(1);
  const countFour = publishOne(4, { participant_public_key: 'internal-key' });

  assert.deepEqual(countOne, countFour);
  assert.deepEqual(countOne, [
    { answerCode: 'f', suppressed: true, participantCount: null }
  ]);
});

test('aggregate publication boundary allowlists only public fields', () => {
  const [published] = publishOne(1);

  assert.deepEqual(Object.keys(published).sort(), [
    'answerCode',
    'participantCount',
    'suppressed'
  ]);
  assert.equal('participant_id' in published, false);
  assert.equal('question_id' in published, false);
  assert.equal('recorded_at' in published, false);
  assert.equal('extra' in published, false);
});

test('threshold-reaching aggregate exposes only the normalized public count', () => {
  const [published] = publishOne(5);

  assert.deepEqual(published, {
    answerCode: 'f',
    suppressed: false,
    participantCount: 5
  });
  assert.deepEqual(Object.keys(published).sort(), [
    'answerCode',
    'participantCount',
    'suppressed'
  ]);
});

test('aggregate publication rejects unknown or duplicate answer codes', () => {
  assert.throws(() => publishResearchAggregateCell({
    answerCode: 'unknown', participantCount: 10, minimumCellSize: 5
  }), /answer code/i);

  assert.throws(() => publishResearchAggregateRows([
    { answer_code: 'f', participant_count: '10' },
    { answer_code: 'f', participant_count: '11' }
  ], { minimumCellSize: 5 }), /duplicate/i);
});

test('aggregate publication enforces the bounded answer-row contract', () => {
  assert.equal(MAX_PUBLISHED_AGGREGATE_ROWS, 3);
  assert.throws(() => publishResearchAggregateRows([
    { answer_code: 'f', participant_count: '10' },
    { answer_code: 'c', participant_count: '10' },
    { answer_code: 'i', participant_count: '10' },
    { answer_code: 'f', participant_count: '10' }
  ], { minimumCellSize: 5 }), /row bound/i);
});

test('aggregate participant counts must be canonical safe integers', () => {
  for (const participantCount of ['', '01', '1e2', '-1', '9007199254740992']) {
    assert.throws(() => publishResearchAggregateCell({
      answerCode: 'f', participantCount, minimumCellSize: 5
    }), /participant count/i);
  }
  assert.throws(() => publishResearchAggregateCell({
    answerCode: 'f', participantCount: Number.MAX_SAFE_INTEGER + 1, minimumCellSize: 5
  }), /participant count/i);
});

test('aggregate publication output and methodology metadata are immutable', () => {
  const rows = publishOne(5);
  const methodology = buildResearchAggregateMethodology({
    generatedAt: '2026-10-05T12:00:00Z',
    minimumCellSize: 5
  });

  assert.equal(Object.isFrozen(rows), true);
  assert.equal(Object.isFrozen(rows[0]), true);
  assert.equal(Object.isFrozen(methodology), true);
  assert.equal(Object.isFrozen(methodology.grouping), true);
  assert.equal(Object.isFrozen(methodology.suppression), true);
});
