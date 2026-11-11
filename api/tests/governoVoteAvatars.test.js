const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeVoteName, parseExistingAvatar, loadGovernmentVoteAvatars } = require('../services/governoVoteAvatars');

const avatar = { skinColor: '#FDBCB4', hairStyle: 'short', hairColor: '#333333' };

test('normalizes whitespace and case while preserving the name', () => {
  assert.equal(normalizeVoteName('  Alessandro   Di  Battista '), 'alessandro di battista');
  assert.equal(normalizeVoteName(null), '');
});

test('only accepts an existing valid avatar config, including double-encoded JSON', () => {
  assert.deepEqual(parseExistingAvatar(JSON.stringify(JSON.stringify(avatar))), avatar);
  assert.equal(parseExistingAvatar('{}'), null);
  assert.equal(parseExistingAvatar('invalid'), null);
});

test('does not query for empty names', async () => {
  const pool = { query: () => { throw new Error('unexpected query'); } };
  assert.deepEqual(await loadGovernmentVoteAvatars(pool, [' ', '']), {});
});

test('loads public avatar configs in one query, without leaking unrelated fields', async () => {
  let calls = 0;
  const pool = { query: async (sql, values) => {
    calls++;
    assert.match(sql, /u.status IN \('a', 'v'\)/);
    assert.match(sql, /political_candidacies/);
    assert.match(sql, /is_activist/);
    assert.deepEqual(values, [['alessandro di battista', 'lucio caracciolo']]);
    return { rows: [
      { name_key: 'alessandro di battista', avatar_config: avatar },
      { name_key: 'lucio caracciolo', avatar_config: null }
    ] };
  } };
  const result = await loadGovernmentVoteAvatars(pool, [
    'Alessandro Di Battista', ' Alessandro  Di Battista ', 'Lucio Caracciolo'
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(result, { 'alessandro di battista': avatar });
});

test('does not associate an avatar with an ambiguous name', async () => {
  const pool = { query: async () => ({ rows: [
    { name_key: 'mario rossi', avatar_config: avatar },
    { name_key: 'mario rossi', avatar_config: avatar }
  ] }) };
  assert.deepEqual(await loadGovernmentVoteAvatars(pool, ['Mario Rossi']), {});
});

test('falls back to legacy roles when the capability tables are not available', async () => {
  let calls = 0;
  const pool = { query: async (sql) => {
    calls++;
    if (calls === 1) {
      const error = new Error('missing table');
      error.code = '42P01';
      throw error;
    }
    assert.match(sql, /u.ruolo IN/);
    return { rows: [{ name_key: 'enrico letta', avatar_config: JSON.stringify(avatar) }] };
  } };
  assert.deepEqual(await loadGovernmentVoteAvatars(pool, ['Enrico Letta']), { 'enrico letta': avatar });
  assert.equal(calls, 2);
});
