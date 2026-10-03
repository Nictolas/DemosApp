const test = require('node:test');
const assert = require('node:assert/strict');
const { readPublishedResearchAnswerAggregates } = require('../services/researchAggregateReader');

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
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM research\.current_opinion_responses/i);
  assert.match(calls[0].sql, /COUNT\(DISTINCT participant_id\)/i);
  assert.deepEqual(calls[0].params, ['energia_nucleare']);
  assert.deepEqual(result, [
    { answerCode: 'c', suppressed: true, participantCount: null },
    { answerCode: 'f', suppressed: false, participantCount: 12 }
  ]);
});

test('aggregate reader fails closed without an explicit threshold', async () => {
  const client = { query: async () => ({
    rows: [{ answer_code: 'f', participant_count: '100' }]
  }) };
  await assert.rejects(
    () => readPublishedResearchAnswerAggregates(client, { questionId: 'q-1' }),
    /Explicit aggregate minimum cell size/
  );
});
