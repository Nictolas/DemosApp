const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveSelectionFields,
  loadCurrentSupporterTokens,
} = require('../services/currentSupporterPushService');

test('legacy field projection still resolves exactly the Italian representative field for its level', () => {
  assert.deepEqual(resolveSelectionFields({ kind: 'representative', level: 'EUROPEO' }), ['rappresentante_europeo']);
  assert.deepEqual(resolveSelectionFields({ kind: 'representative', level: 'CAMERA' }), ['rappresentante_camera']);
  assert.deepEqual(resolveSelectionFields({ kind: 'representative', level: 'SENATO' }), ['rappresentante_senato']);
  assert.deepEqual(resolveSelectionFields({ kind: 'representative', level: 'REGIONE' }), ['rappresentante_regionale']);
  assert.deepEqual(resolveSelectionFields({ kind: 'representative', level: 'COMUNE' }), ['rappresentante_comune']);
});

test('candidate and combined legacy projections remain available during migration', () => {
  const candidate = resolveSelectionFields({ kind: 'candidate' });
  assert.deepEqual(candidate, [
    'candidato_europeo', 'candidato_camera', 'candidato_senato', 'candidato_regionale', 'candidato_comune',
  ]);
  const both = resolveSelectionFields({ kind: 'both' });
  assert.equal(both.length, 10);
});

test('supporter token lookup resolves supporter identity through canonical political selections', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params });
      if (/FROM public\.political_selections ps/.test(sql)) return { rows: [{ id: 'supporter-1' }] };
      if (/FROM public\.users u/.test(sql)) {
        return { rows: [{ id: 'supporter-1', fcm_tokens: ['tok-1', 'tok-1', 'tok-2'] }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const rows = await loadCurrentSupporterTokens(pool, {
    subjectUserId: 'politician-1',
    kind: 'representative',
    level: 'CAMERA',
  });
  assert.deepEqual(rows, [{ userId: 'supporter-1', tokens: ['tok-1', 'tok-2'] }]);
  assert.match(calls[0].sql, /FROM public\.political_selections ps/);
  assert.match(calls[1].sql, /FROM public\.user_devices d/);
  assert.match(calls[1].sql,
    /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.user_devices registered/);
  assert.match(calls[1].sql,
    /btrim\(registered\.fcm_token\) = btrim\(legacy\.token\)/);
  assert.match(calls[1].sql, /FROM public\.users u/);
  assert.match(calls[1].sql, /u\.id = ANY\(\$1::uuid\[\]\)/);
  assert.doesNotMatch(calls[1].sql, /u\.id::text = ANY/);
  assert.match(calls[1].sql, /LEFT JOIN public\.user_consents uc/);
  assert.match(calls[0].sql, /ps\.political_office_id = \$3/);
  assert.equal(calls[0].params[2], 'it.camera');
  assert.doesNotMatch(calls[0].sql, /\bsostenitori\b/i);
});
