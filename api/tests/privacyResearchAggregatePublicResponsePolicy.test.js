const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_RESEARCH_AGGREGATE_RESPONSE_BYTES,
  buildResearchAggregatePublicResponse
} = require('../services/researchAggregatePublicResponsePolicy');
const {
  buildResearchAggregateMethodology
} = require('../services/researchAggregateMethodology');

const methodology = () => buildResearchAggregateMethodology({
  generatedAt: '2026-10-05T13:00:00Z',
  minimumCellSize: 5
});

const validRows = () => [
  { answerCode: 'f', suppressed: false, participantCount: 8 },
  { answerCode: 'c', suppressed: true, participantCount: null },
  { answerCode: 'i', suppressed: true, participantCount: null }
];

test('aggregate public response allowlists methodology and row fields', () => {
  const rows = validRows();
  rows[0] = {
    ...rows[0],
    participant_id: 'internal-row-link',
    recordedAt: 'internal-time'
  };
  rows[1] = { ...rows[1], extra: 'internal-extra' };

  const response = buildResearchAggregatePublicResponse({
    methodology: {
      ...methodology(),
      participant_id: 'internal-methodology-link',
      debug: 'internal-debug'
    },
    rows
  });

  assert.deepEqual(Object.keys(response).sort(), ['methodology', 'rows']);
  assert.deepEqual(Object.keys(response.methodology).sort(), [
    'cacheTtlSeconds', 'countingUnit', 'datasetVersion', 'freshnessSemantics',
    'generatedAt', 'grouping', 'materialization', 'publicationMode',
    'sourceProjection', 'suppression'
  ]);
  assert.deepEqual(Object.keys(response.rows[0]).sort(), [
    'answerCode', 'participantCount', 'suppressed'
  ]);
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes('internal-methodology-link'), false);
  assert.equal(serialized.includes('internal-row-link'), false);
  assert.equal(serialized.includes('internal-debug'), false);
});

test('aggregate public response validates suppression semantics against the threshold', () => {
  const leakedSuppressed = validRows();
  leakedSuppressed[1] = { answerCode: 'c', suppressed: true, participantCount: 1 };
  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: leakedSuppressed
  }), /remain hidden/i);

  const tooSmallPublished = validRows();
  tooSmallPublished[0] = { answerCode: 'f', suppressed: false, participantCount: 4 };
  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: tooSmallPublished
  }), /published aggregate count/i);
});

test('aggregate public response requires the complete canonical answer-code shape', () => {
  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: validRows().slice(0, 2)
  }), /public rows/i);

  const wrongOrder = validRows();
  [wrongOrder[0], wrongOrder[1]] = [wrongOrder[1], wrongOrder[0]];
  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: wrongOrder
  }), /answer code order/i);

  const duplicate = validRows();
  duplicate[1] = { answerCode: 'f', suppressed: true, participantCount: null };
  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: duplicate
  }), /answer code order/i);

  const unknown = validRows();
  unknown[2] = { answerCode: 'x', suppressed: true, participantCount: null };
  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: unknown
  }), /answer code order/i);
});

test('aggregate public response rejects altered freshness or materialization methodology', () => {
  for (const patch of [
    { freshnessSemantics: 'stale-snapshot' },
    { publicationMode: 'materialized' },
    { materialization: 'enabled' },
    { cacheTtlSeconds: 60 },
    { sourceProjection: 'research.raw_events' }
  ]) {
    assert.throws(() => buildResearchAggregatePublicResponse({
      methodology: { ...methodology(), ...patch },
      rows: validRows()
    }), /methodology contract/i);
  }
});

test('aggregate public response is deeply immutable and comfortably bounded', () => {
  const response = buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: [
      { answerCode: 'f', suppressed: false, participantCount: Number.MAX_SAFE_INTEGER },
      { answerCode: 'c', suppressed: true, participantCount: null },
      { answerCode: 'i', suppressed: true, participantCount: null }
    ]
  });

  assert.equal(Object.isFrozen(response), true);
  assert.equal(Object.isFrozen(response.methodology), true);
  assert.equal(Object.isFrozen(response.methodology.grouping), true);
  assert.equal(Object.isFrozen(response.methodology.suppression), true);
  assert.equal(Object.isFrozen(response.rows), true);
  assert.equal(Object.isFrozen(response.rows[0]), true);
  assert.ok(Buffer.byteLength(JSON.stringify(response), 'utf8') <= MAX_RESEARCH_AGGREGATE_RESPONSE_BYTES);
  assert.equal(MAX_RESEARCH_AGGREGATE_RESPONSE_BYTES, 4096);
});
