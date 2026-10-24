'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const selection = require('../services/politicalSelectionService');

function mockDatabase({ row, deleted = true, mirror = true }) {
  const calls = [];
  const client = {
    async query(sql, params) {
      const s = String(sql).trim();
      calls.push({ sql: s, params });
      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') return { rows: [] };
      if (s.startsWith('DELETE FROM political_selections')) return { rows: deleted ? [{ user_id: row.user_id }] : [] };
      if (s.includes("to_regclass('public.user_representatives')")) return { rows: [{ available: mirror }] };
      if (s.startsWith('UPDATE users') || s.startsWith('UPDATE user_representatives')) return { rows: [], rowCount: 1 };
      throw new Error('Unexpected client query: ' + s);
    },
    release() { calls.push({ sql: 'RELEASE' }); }
  };
  return {
    calls,
    connect: async () => client,
    async query(sql) {
      calls.push({ sql: String(sql).trim() });
      if (String(sql).includes('FROM political_selections ps')) {
        return { rows: [row] };
      }
      throw new Error('Unexpected pool query: ' + String(sql));
    }
  };
}

async function withEligibility(mock, callback) {
  const modulePath = require.resolve('../services/politicalEligibilityService');
  const existing = require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: mock };
  try { await callback(); }
  finally {
    if (existing) require.cache[modulePath] = existing;
    else delete require.cache[modulePath];
  }
}

function saved(kind = 'representative') {
  return {
    user_id: 'elector-1',
    selection_kind: kind,
    jurisdiction_id: 'it',
    political_office_id: 'it.regional',
    selected_user_id: 'politician-1',
    selected_candidacy_id: kind === 'candidate' ? 'candidacy-1' : null,
    selected_mandate_id: kind === 'representative' ? 'mandate-1' : null,
    source: 'matching',
    context: {},
  };
}

test('expired regional mandate clears canonical and both legacy stores, returning an empty selection', async () => {
  const db = mockDatabase({ row: saved() });
  await withEligibility({
    isRepresentativeSelectionEligible: async () => ({ strict: true, subjects: [] }),
  }, async () => {
    const result = await selection.loadCurrentPoliticalSelections(db, {
      userId: 'elector-1', kind: 'representative', adapterId: 'it'
    });
    assert.deepEqual(result.selections, []);
  });
  assert.ok(db.calls.some(c => c.sql.startsWith('DELETE FROM political_selections')));
  assert.ok(db.calls.some(c => c.sql.includes('UPDATE users SET rappresentante_regionale = NULL')));
  assert.ok(db.calls.some(c => c.sql.includes('UPDATE user_representatives SET rappresentante_regionale = NULL')));
  assert.ok(db.calls.some(c => c.sql === 'COMMIT'));
  const deleteCall = db.calls.find(c => c.sql.startsWith('DELETE FROM political_selections'));
  assert.deepEqual(deleteCall.params, ['elector-1', 'representative', 'it.regional', 'politician-1']);
  assert.ok(db.calls.some(c => c.sql.includes('rappresentante_regionale::text = $2')));
});

test('active mandate remains selected and causes no writes', async () => {
  const row = saved();
  const db = mockDatabase({ row });
  await withEligibility({
    isRepresentativeSelectionEligible: async () => ({
      strict: true, subjects: [{ id: 'politician-1', mandate_id: 'mandate-1' }]
    }),
  }, async () => {
    const result = await selection.loadCurrentPoliticalSelections(db, {
      userId: 'elector-1', kind: 'representative', adapterId: 'it'
    });
    assert.equal(result.selections.length, 1);
  });
  assert.equal(db.calls.some(c => c.sql === 'BEGIN'), false);
});

test('changing mandate ID invalidates only the obsolete office choice', async () => {
  const db = mockDatabase({ row: saved() });
  await withEligibility({
    isRepresentativeSelectionEligible: async () => ({
      strict: true, subjects: [{ id: 'politician-1', mandate_id: 'different-new-mandate' }]
    }),
  }, async () => {
    const result = await selection.loadCurrentPoliticalSelections(db, {
      userId: 'elector-1', kind: 'representative', adapterId: 'it'
    });
    assert.deepEqual(result.selections, []);
  });
});

test('finished candidate selection clears candidate fields, not representative fields', async () => {
  const db = mockDatabase({ row: saved('candidate') });
  await withEligibility({
    isCandidateSelectionEligible: async () => ({ strict: true, subjects: [] })
  }, async () => {
    const result = await selection.loadCurrentPoliticalSelections(db, {
      userId: 'elector-1', kind: 'candidate', adapterId: 'it'
    });
    assert.deepEqual(result.selections, []);
  });
  const updates = db.calls.filter(c => c.sql.startsWith('UPDATE'));
  assert.equal(updates.length, 2);
  assert.ok(updates.every(c => c.sql.includes('candidato_regionale')));
  assert.ok(updates.every(c => !c.sql.includes('rappresentante_regionale')));
});

test('legacy or missing capability schemas never trigger destructive cleanup', async () => {
  const db = mockDatabase({ row: saved() });
  await withEligibility({
    isRepresentativeSelectionEligible: async () => ({ strict: false, subjects: [] })
  }, async () => {
    const result = await selection.loadCurrentPoliticalSelections(db, {
      userId: 'elector-1', kind: 'representative', adapterId: 'it'
    });
    assert.equal(result.selections.length, 1);
  });
  assert.equal(db.calls.some(c => c.sql === 'BEGIN'), false);
});

test('concurrent replacement is protected by matching the old selected ID', async () => {
  const db = mockDatabase({ row: saved(), deleted: false });
  await withEligibility({
    isRepresentativeSelectionEligible: async () => ({ strict: true, subjects: [] }),
  }, async () => {
    await selection.loadCurrentPoliticalSelections(db, {
      userId: 'elector-1', kind: 'representative', adapterId: 'it'
    });
  });
  assert.equal(db.calls.some(c => c.sql.startsWith('UPDATE users')), false);
  assert.equal(db.calls.some(c => c.sql.startsWith('UPDATE user_representatives')), false);
  assert.ok(db.calls.some(c => c.sql === 'COMMIT'));
});
