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

test('aggregate public response allowlists methodology and row fields', () => {
  const response = buildResearchAggregatePublicResponse({
    methodology: {
      ...methodology(),
      participant_id: 'internal-methodology-link',
      debug: 'internal-debug'
    },
    rows: [
      {
        answerCode: 'f',
        suppressed: false,
        participantCount: 8,
        participant_id: 'internal-row-link',
        recordedAt: 'internal-time'
      },
      {
        answerCode: 'c',
        suppressed: true,
        participantCount: null,
        extra: 'internal-extra'
      }
    ]
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
  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: [{ answerCode: 'f', suppressed: true, participantCount: 1 }]
  }), /remain hidden/i);

  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: [{ answerCode: 'f', suppressed: false, participantCount: 4 }]
  }), /published aggregate count/i);
});

test('aggregate public response rejects duplicate or unknown answer codes', () => {
  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: [
      { answerCode: 'f', suppressed: false, participantCount: 5 },
      { answerCode: 'f', suppressed: false, participantCount: 6 }
    ]
  }), /answer code/i);

  assert.throws(() => buildResearchAggregatePublicResponse({
    methodology: methodology(),
    rows: [{ answerCode: 'x', suppressed: false, participantCount: 5 }]
  }), /answer code/i);
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
      rows: []
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
