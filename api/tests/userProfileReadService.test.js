'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { RESIDENCE_FIELDS, buildUserResidenceSql, loadUserResidence } = require('../services/userProfileReadService');

test('residence projection is profile-first and limited to the four fields', () => {
  const sql = buildUserResidenceSql();
  assert.match(sql, /FROM users u\s+LEFT JOIN user_profile p ON p\.user_id = u\.id/);
  for (const field of RESIDENCE_FIELDS) assert.ok(sql.includes(`COALESCE(p.${field}, u.${field}) AS ${field}`));
  assert.match(sql, /WHERE u\.id = \$1/);
  assert.doesNotMatch(sql, /email|nome|cognome|fcm_token/i);
  assert.doesNotMatch(sql, /UPDATE|DELETE|INSERT|DROP/);
});

test('read returns projected data and forwards only the ID', async () => {
  const expected = { id: 'u1', paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' };
  const calls = [];
  const row = await loadUserResidence({ query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [expected] };
  } }, 'u1');
  assert.deepEqual(row, expected);
  assert.deepEqual(calls[0].params, ['u1']);
  assert.equal(calls.length, 1);
});

test('feed projection includes only two account linkage fields', async () => {
  const sql = buildUserResidenceSql({ includeFeedSelections: true });
  assert.match(sql, /u\.attivisti, u\.organizzazioni/);
  assert.doesNotMatch(sql, /p\.attivisti/);
  const expected = { id: 'u1', attivisti: null, organizzazioni: null };
  const row = await loadUserResidence({ query: async () => ({ rows: [expected] }) }, 'u1', { includeFeedSelections: true });
  assert.deepEqual(row, expected);
});

test('missing profile table falls back to legacy users', async () => {
  let calls = 0;
  const row = await loadUserResidence({ query: async (sql, params) => {
    calls += 1;
    assert.deepEqual(params, ['u2']);
    if (calls === 1) {
      const error = new Error('relation missing');
      error.code = '42P01';
      throw error;
    }
    assert.match(sql, /FROM users WHERE id = \$1/);
    assert.doesNotMatch(sql, /user_profile/);
    return { rows: [{ id: 'u2', comune_residenza: 'Lucca' }] };
  } }, 'u2');
  assert.equal(calls, 2);
  assert.equal(row.comune_residenza, 'Lucca');
});

test('unrelated permission errors propagate without fallback', async () => {
  const failure = Object.assign(new Error('permission denied'), { code: '42501' });
  await assert.rejects(loadUserResidence({ query: async () => { throw failure; } }, 'u3'), (error) => error === failure);
});

test('missing user returns null', async () => {
  const row = await loadUserResidence({ query: async () => ({ rows: [] }) }, 'u4');
  assert.equal(row, null);
});
