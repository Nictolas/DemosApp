const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildProgramContent,
  toLegacyProgramView,
  resolveEditableCandidacy,
  finalizeCandidacyProgram
} = require('../services/candidacyProgramService');

const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'create-candidacy-program-model.sql'), 'utf8');

test('program content keeps five proposal/url slots for current UI compatibility', () => {
  const content = buildProgramContent({ proposta_1: 'A', url_1: 'https://a', proposta_3: 'C' });
  assert.equal(content.proposals.length, 5);
  assert.deepEqual(content.proposals[0], { text: 'A', url: 'https://a' });
  assert.deepEqual(content.proposals[2], { text: 'C', url: '' });
  const view = toLegacyProgramView({ candidacy_id: 'c1', content });
  assert.equal(view.proposta1, 'A');
  assert.equal(view.proposta3, 'C');
  assert.equal(view.candidacy_id, 'c1');
});

test('editing without candidacy_id is allowed only with exactly one active candidacy', async () => {
  const one = { query: async () => ({ rows: [{ id: 'c1', user_id: 'u1' }] }) };
  assert.equal((await resolveEditableCandidacy(one, 'u1')).id, 'c1');

  const many = { query: async () => ({ rows: [{ id: 'c1' }, { id: 'c2' }] }) };
  await assert.rejects(() => resolveEditableCandidacy(many, 'u1'), (error) => error.code === 'PROGRAMMA_CANDIDACY_REQUIRED');

  const none = { query: async () => ({ rows: [] }) };
  await assert.rejects(() => resolveEditableCandidacy(none, 'u1'), (error) => error.code === 'PROGRAMMA_ACTIVE_CANDIDACY_REQUIRED');
});

test('losing candidacy discards editable program without snapshot', async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push([String(sql), params]); return { rows: [] }; } };
  const result = await finalizeCandidacyProgram(client, { candidacyId: 'c1', result: 'NOT_ELECTED' });
  assert.equal(result.snapshot, null);
  assert.equal(result.discarded, true);
  assert.match(calls[0][0], /DELETE FROM political_programs/);
});

test('winning candidacy freezes immutable mandate snapshot then removes editable copy', async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      const s = String(sql);
      calls.push([s, params]);
      if (s.includes('INSERT INTO mandate_program_snapshots')) return { rows: [{ mandate_id: 'm1', candidacy_id: 'c1' }] };
      if (s.includes('DELETE FROM political_programs')) return { rows: [] };
      return { rows: [] };
    }
  };
  const result = await finalizeCandidacyProgram(client, { candidacyId: 'c1', result: 'ELECTED', mandateId: 'm1' });
  assert.equal(result.snapshot.mandate_id, 'm1');
  assert.match(calls[0][0], /ON CONFLICT \(mandate_id\) DO NOTHING/);
  assert.match(calls[1][0], /DELETE FROM political_programs/);
});

test('program migration is candidacy-scoped and only backfills unambiguous active candidacies', () => {
  assert.match(migration, /candidacy_id UUID NOT NULL UNIQUE REFERENCES political_candidacies/i);
  assert.match(migration, /mandate_id UUID NOT NULL UNIQUE REFERENCES political_mandates/i);
  assert.match(migration, /SELECT COUNT\(\*\)[\s\S]*status = 'ACTIVE'[\s\S]*\) = 1/i);
  assert.match(migration, /ON CONFLICT \(candidacy_id\) DO NOTHING/i);
});
