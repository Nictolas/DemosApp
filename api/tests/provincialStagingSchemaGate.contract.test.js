'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const audit = fs.readFileSync(
  path.join(__dirname, '..', 'qa', 'provincial_staging_prerequisites_readonly.sql'), 'utf8',
);

test('provincial staging preflight is read-only, metadata-only, and scoped to known relations', () => {
  const sql = audit.replace(/^--.*$/gm, '');
  const rows = [...sql.matchAll(/\('([a-z_]+)',\s*(true|false),\s*'/g)]
    .map((m) => ({ name: m[1], mandatory: m[2] === 'true' }));
  const mandatory = rows.filter((row) => row.mandatory).map((row) => row.name).sort();
  const optional = rows.filter((row) => !row.mandatory).map((row) => row.name).sort();

  assert.deepEqual(mandatory, [
    'eventi', 'political_candidacies', 'political_mandates', 'political_selections',
    'unita_elettorale', 'unita_elettorale_territorio', 'user_consents', 'users',
  ].sort());
  assert.deepEqual(optional, [
    'user_electoral_unit_memberships', 'user_political_territories',
  ].sort());
  assert.equal(new Set(rows.map((row) => row.name)).size, rows.length);

  assert.match(sql, /pg_catalog\.pg_namespace/);
  assert.match(sql, /pg_catalog\.pg_class/);
  assert.match(sql, /pg_catalog\.pg_policy/);
  assert.match(sql, /has_table_privilege\('demos_staging_runtime'/);
  assert.match(sql, /BLOCKED_NO_SELECT_GRANT/);
  assert.match(sql, /BLOCKED_MISSING_RELATION/);
  assert.match(sql, /METADATA_PASS_NOT_E2E_GO/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY|DO|CALL|CREATE)\b/i);
  assert.doesNotMatch(sql, /\b(?:FROM|JOIN)\s+(?:public\.)?(?:users|user_consents|political_selections|political_candidacies|political_mandates)\b/i);
});
