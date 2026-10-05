const test = require('node:test');
const assert = require('node:assert/strict');
const { readPublishedResearchAnswerAggregates } = require('../services/researchAggregateReader');

const fixedClock = () => new Date('2026-10-04T02:00:00Z');

test('aggregate reader reads the fresh projection and suppresses small cells', async () => {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [
      { answer_code: 'c', participant_count: '3' },
      { answer_code: 'f', participant_count: '12' }
    ] };
  } };

  const result = await readPublishedResearchAnswerAggregates(client, {
    questionId: 'energia_nucleare',
    minimumCellSize: 8
  }, { clock: fixedClock });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM research\.current_opinion_responses/i);
  assert.match(calls[0].sql, /COUNT\(DISTINCT participant_id\)/i);
  assert.match(calls[0].sql, /answer_code\s+IN\s*\('f',\s*'c',\s*'i'\)/i);
  assert.deepEqual(calls[0].params, ['energia_nucleare']);
  assert.deepEqual(result, {
    methodology: {
      datasetVersion: 'research-answer-aggregate-v1',
      generatedAt: '2026-10-04T02:00:00.000Z',
      sourceProjection: 'research.current_opinion_responses',
      freshnessSemantics: 'active-and-unexpired-at-query-time',
      countingUnit: 'distinct-participant-per-answer',
      grouping: ['question_id', 'answer_code'],
      publicationMode: 'live-query',
      materialization: 'disabled',
      cacheTtlSeconds: 0,
      suppression: { policy: 'small-cell', minimumCellSize: 8 }
    },
    rows: [
      { answerCode: 'f', suppressed: false, participantCount: 12 },
      { answerCode: 'c', suppressed: true, participantCount: null },
      { answerCode: 'i', suppressed: true, participantCount: null }
    ]
  });
});

test('aggregate reader fails closed without an explicit threshold before querying', async () => {
  let queryCalls = 0;
  const client = { query: async () => {
    queryCalls += 1;
    return { rows: [{ answer_code: 'f', participant_count: '100' }] };
  } };
  await assert.rejects(
    () => readPublishedResearchAnswerAggregates(client, { questionId: 'q-1' }),
    /Explicit aggregate minimum cell size/
  );
  assert.equal(queryCalls, 0);
});

test('aggregate reader does not accept caller-supplied generation timestamps', async () => {
  const client = { query: async () => ({
    rows: [{ answer_code: 'f', participant_count: '10' }]
  }) };

  const result = await readPublishedResearchAnswerAggregates(client, {
    questionId: 'q-1',
    minimumCellSize: 5,
    generatedAt: '2099-01-01T00:00:00Z'
  }, { clock: fixedClock });

  assert.equal(result.methodology.generatedAt, '2026-10-04T02:00:00.000Z');
  assert.equal(result.methodology.publicationMode, 'live-query');
  assert.equal(result.methodology.materialization, 'disabled');
  assert.equal(result.methodology.cacheTtlSeconds, 0);
});

test('aggregate reader rejects an invalid clock and never queries Research', async () => {
  let queryCalls = 0;
  const client = { query: async () => {
    queryCalls += 1;
    return { rows: [] };
  } };

  await assert.rejects(
    () => readPublishedResearchAnswerAggregates(
      client,
      { questionId: 'q-1', minimumCellSize: 5 },
      { clock: 'not-a-function' }
    ),
    /clock required/i
  );
  assert.equal(queryCalls, 0);
});
