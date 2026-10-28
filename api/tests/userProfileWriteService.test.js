'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PROFILE_FIELDS, buildUserProfileUpsert, upsertUserProfileFields } = require('../services/userProfileWriteService');

test('all expected profile fields are allowed, but arbitrary SQL identifiers are ignored', () => {
  for (const field of ['cittadinanza', 'genere', 'data_nascita', 'comune_residenza', 'grado_elezione', 'avatar_config']) assert.ok(PROFILE_FIELDS.has(field));
  assert.equal(PROFILE_FIELDS.has('is_admin'), false);
  assert.equal(PROFILE_FIELDS.has('ruolo'), false);
  const stmt = buildUserProfileUpsert({ cittadinanza: 'it', is_admin: true, 'comune_residenza; DROP TABLE users': 'X', comune_residenza: 'Pisa' });
  assert.deepEqual(stmt.values, ['it', 'Pisa']);
  assert.match(stmt.sql, /INSERT INTO user_profile \(user_id, cittadinanza, comune_residenza\)/);
  assert.doesNotMatch(stmt.sql, /DROP TABLE|is_admin/);
});

test('profile mirror performs exactly one upsert and uses bound parameters', async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({ sql, params }); return { rowCount: 1 }; } };
  const written = await upsertUserProfileFields(client, 'u1', { regione_residenza: 'TO', data_nascita: '1990-01-01', nome: 'ignored' });
  assert.equal(written, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ['u1', 'TO', '1990-01-01']);
  assert.match(calls[0].sql, /ON CONFLICT \(user_id\) DO UPDATE SET/);
  assert.match(calls[0].sql, /updated_at = NOW\(\)/);
});

test('null is mirrored (explicit clearing), undefined is not', () => {
  const stmt = buildUserProfileUpsert({ comune_residenza: null, paese_residenza: undefined });
  assert.deepEqual(stmt.values, [null]);
  assert.doesNotMatch(stmt.sql, /paese_residenza/);
});

test('account-only edits are not replicated and never cause an insert', async () => {
  let queries = 0;
  const result = await upsertUserProfileFields({ query: async () => { queries += 1; } }, 'u1', { nome: 'Sara', status: 'a', is_admin: true });
  assert.equal(result, false);
  assert.equal(queries, 0);
});

test('database errors propagate for atomic rollback by the caller', async () => {
  const err = Object.assign(new Error('not allowed'), { code: '42501' });
  await assert.rejects(
    upsertUserProfileFields({ query: async () => { throw err; } }, 'u1', { cittadinanza: 'it' }),
    (e) => e === err
  );
});

test('invalid input cannot be converted into a write', async () => {
  assert.throws(() => buildUserProfileUpsert(null), TypeError);
  assert.throws(() => buildUserProfileUpsert([]), TypeError);
  await assert.rejects(upsertUserProfileFields({}, 'u1', { cittadinanza: 'it' }), TypeError);
  await assert.rejects(upsertUserProfileFields({query: async () => {}}, '', {cittadinanza:'it'}), TypeError);
});
