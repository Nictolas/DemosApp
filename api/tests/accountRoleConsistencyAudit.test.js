'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../scripts/audit-account-role-consistency-20261029.sql'), 'utf8');
const statements = sql.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');

test('F12-12B audit is SELECT-only and does not return personal row identifiers', () => {
  assert.doesNotMatch(statements, /\b(?:UPDATE|DELETE|INSERT|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|COPY)\b/i);
  assert.match(statements, /FROM public\.users u/);
  assert.match(statements, /GROUP BY status/);
  assert.match(statements, /GROUP BY source, status/);
  assert.doesNotMatch(statements, /SELECT\s+(?:u\.)?(?:id|email|name|nome|cognome)\b/i);
});

test('F12-12B tracks active account status independently from account type and mandate status', () => {
  assert.match(statements, /status = 'a'/);
  assert.match(statements, /status = 'active'/);
  assert.match(statements, /account_type_legacy_role_mismatch/);
  assert.match(statements, /pm\.source <> 'LEGACY_BACKFILL'/);
  assert.match(statements, /role_p_cp_no_current_nonlegacy_mandate/);
});
