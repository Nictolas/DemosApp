const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeChange,
  createSupporterOpinionNotifications,
} = require('../services/politicalOpinionNotificationService');

test('same value and missing previous answer are not notification changes', () => {
  assert.equal(normalizeChange({ opinionId: 'x', previousValue: 'f', newValue: 'f' }), null);
  assert.equal(normalizeChange({ opinionId: 'x', previousValue: null, newValue: 'f' }), null);
});

test('real f/c/i change is normalized', () => {
  assert.deepEqual(
    normalizeChange({ opinionId: '42', previousValue: 'f', newValue: 'c' }),
    { opinionId: '42', previousValue: 'f', newValue: 'c' },
  );
});

test('notification insert targets users resolved by canonical current selections', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params });
      if (/FROM public\.political_selections ps/.test(sql)) return { rows: [{ id: 'supporter-1' }, { id: 'supporter-2' }] };
      if (/FROM public\\.opinioni_domande/.test(sql)) return { rows: [{ id: '42', text: 'Energia nucleare' }] };
      if (/INSERT INTO public\\.political_opinion_notifications/.test(sql)) {
        return { rows: [{ id: 'n1' }, { id: 'n2' }], rowCount: 2 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const result = await createSupporterOpinionNotifications(db, {
    subjectUserId: '11111111-1111-1111-1111-111111111111',
    changes: [{ opinionId: '42', previousValue: 'f', newValue: 'c' }],
  });

  assert.deepEqual(result, { created: 2, changes: 1 });
  assert.match(calls[0].sql, /FROM public\.political_selections ps/);
  const insert = calls.find((call) => /INSERT INTO public\\.political_opinion_notifications/.test(call.sql));
  assert.match(insert.sql, /FROM public\\.users supporter/);
  assert.match(insert.sql, /LEFT JOIN public\\.user_consents uc/);
  assert.match(insert.sql, /supporter\.id::text = ANY\(\$6::text\[\]\)/);
  assert.deepEqual(insert.params[5], ['supporter-1', 'supporter-2']);
  assert.doesNotMatch(insert.sql, /rappresentante_|candidato_|FROM\s+sostenitori\b/i);
});

test('no real changes performs no database work', async () => {
  let calls = 0;
  const db = { async query() { calls += 1; throw new Error('must not query'); } };
  const result = await createSupporterOpinionNotifications(db, {
    subjectUserId: 'u1',
    changes: [
      { opinionId: '1', previousValue: 'f', newValue: 'f' },
      { opinionId: '2', previousValue: null, newValue: 'c' },
    ],
  });
  assert.deepEqual(result, { created: 0, changes: 0 });
  assert.equal(calls, 0);
});
