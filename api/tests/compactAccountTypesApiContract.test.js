'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Admin list, detail and update endpoints retain descriptive account type JSON', () => {
  const src = read('routes/users/search.js');
  assert.match(src, /normalizeAccountType\s*}/);
  const pattern = /account_type:\s*normalizeAccountType\((?:user|updatedUser)\.account_type\)\s*\|\|\s*(?:user|updatedUser)\.account_type/g;
  const projections = src.match(pattern) || [];
  assert.equal(projections.length, 3, 'GET collection, GET single account and PUT response must normalize');
});

test('all currently deployed opinion and survey SQL paths accept both database encodings', () => {
  const stats = read('routes/opinioni/stats.js');
  const surveys = read('utils/sondaggiTextBulk.js');
  assert.doesNotMatch(stats, /u\.account_type\s*=\s*'PERSON'/);
  assert.doesNotMatch(surveys, /u\.account_type\s*=\s*'PERSON'/);
  assert.equal((stats.match(/u\.account_type IN \('PERSON', 'P'\)/g) || []).length, 6);
  assert.equal((surveys.match(/u\.account_type IN \('PERSON', 'P'\)/g) || []).length, 5);
});

test('organization and Admin frontend never excludes new O/E codes from sex gating', () => {
  const organizationRoute = read('routes/organizzazioni.js');
  assert.match(organizationRoute, /account_type IN \('ORGANIZATION', 'O'\)/);
  const frontendRoot = path.join(__dirname, '..', '..', 'client/src/pages/Utenti');
  for (const file of ['utils/columnUtils.ts', 'utils/renderUtils.tsx']) {
    const contents = fs.readFileSync(path.join(frontendRoot, file), 'utf8');
    assert.match(contents, /'ORGANIZATION', 'O', 'INSTITUTION', 'E'/);
  }
});

test('compact account type still requires distinct legacy role and account status', () => {
  const sql = read('database/users-account-type-poe-20261029.sql');
  assert.match(sql, /user_role_migration_snapshot/);
  assert.match(sql, /RAISE EXCEPTION 'Role projection changed/);
  assert.match(sql, /CHECK \(account_type IN \('P','O','E'\)\)/);
  const roleSql = read('database/users-role-default-e-20261029.sql');
  assert.match(roleSql, /ALTER COLUMN ruolo SET DEFAULT 'E'/);
  assert.doesNotMatch(roleSql, /SET DEFAULT 'a'/);
});


test('GDPR profile export presents stable descriptive account type semantics', () => {
  const source = read('services/privacyDataExportService.js');
  assert.match(source, /normalizeAccountType\(row\.account_type\)/);
});

test('historical capability migration blocks its reapplication after compact cutover', () => {
  const bootstrap = read('database/create-account-capabilities-model.sql');
  assert.match(bootstrap, /DO \$compact_guard\$/);
  assert.match(bootstrap, /Legacy account type bootstrap cannot run after compact P\/O\/E cutover/);
});

test('politician duplicate audit remains dual-encoding and read-only', () => {
  const source = read('scripts/audit-political-duplicate-users-20261028.sql');
  assert.equal((source.match(/account_type IN \('PERSON','P'\)/g) || []).length, 4);
  assert.doesNotMatch(source, /\b(?:UPDATE|DELETE|TRUNCATE|DROP|INSERT)\s+(?:INTO|FROM)?\s*public\.users\b/i);
});
