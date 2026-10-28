'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const stripSqlComments = sql => sql
  .split('\n')
  .filter(line => !line.trimStart().startsWith('--'))
  .join('\n');

for (const file of [
  'api/insert-senatori-da-voti-nominali.sql',
  'api/insert-parlamentari-senato-nuovi.sql'
]) {
  test(`${file}: obsolete importer fails closed instead of creating users`, () => {
    const sql = stripSqlComments(read(file));
    assert.match(sql, /RAISE\s+EXCEPTION/);
    assert.doesNotMatch(sql, /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|TRUNCATE\s+)\b/i);
  });
}

test('political duplicate audit only reads users and mandates', () => {
  const sql = stripSqlComments(read('api/scripts/audit-political-duplicate-users-20261028.sql'));
  assert.match(sql, /FROM\s+public\.users/i);
  assert.match(sql, /FROM\s+public\.political_mandates/i);
  assert.match(sql, /auth_sensitive_groups/);
  assert.match(sql, /conflicting_birthdate_groups/);
  assert.doesNotMatch(sql, /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|TRUNCATE\s+|ALTER\s+TABLE|DROP\s+TABLE)\b/i);
});
