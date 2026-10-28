'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|COPY|CALL|EXECUTE)\b/i);
  });
}

test('legacy execution wrapper refuses to run before opening a database connection', () => {
  const runner = read('api/esegui-insert-senatori.js');
  assert.doesNotMatch(runner, /require\(['"](?:pg|dotenv)['"]\)/);
  assert.doesNotMatch(runner, /\bnew\s+Pool\s*\(/);
  const invoked = spawnSync(process.execPath, ['api/esegui-insert-senatori.js'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/nodb' }
  });
  assert.equal(invoked.status, 1);
  assert.match(invoked.stderr, /legacy importer disabled/i);
});

test('political duplicate audit only reads users and mandates', () => {
  const sql = stripSqlComments(read('api/scripts/audit-political-duplicate-users-20261028.sql'));
  assert.match(sql, /FROM\s+public\.users/i);
  assert.match(sql, /FROM\s+public\.political_mandates/i);
  assert.match(sql, /auth_sensitive_groups/);
  assert.match(sql, /conflicting_birthdate_groups/);
  assert.match(sql, /simultaneous_legacy_chamber_senate_by_name/);
  assert.match(sql, /politician_unauthed_same_dob_for_review/);
  assert.match(sql, /with_authenticated_accounts/);
  // Only authorized review may decide an identity: never introduce a merge in audit SQL.
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|COPY|CALL|EXECUTE)\b/i);
  
});
