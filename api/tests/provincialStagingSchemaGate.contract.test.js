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
  assert.match(sql, /pg_catalog\.pg_attribute/);
  assert.match(sql, /BLOCKED_MISSING_COLUMNS/);
  assert.match(sql, /pg_catalog\.pg_index/);
  assert.match(sql, /BLOCKED_CANONICAL_CONFLICT_KEY_MISSING/);
  assert.match(sql, /legacy_selection_unique_key_conflict/);
  assert.match(sql, /BLOCKED_LEGACY_SELECTION_UNIQUE_KEY_CONFLICT/);
  assert.match(sql, /ARRAY\['selected_user_id', 'selection_kind', 'user_id'\]::name\[\]/);
  assert.match(sql, /BLOCKED_SELECTION_WRITE_GRANTS/);
  assert.match(sql, /BLOCKED_SELECTION_WRITE_POLICIES/);
  for (const operation of ['insert', 'update', 'delete']) {
    assert.match(sql, new RegExp('selection_' + operation + '_policy_declared'));
    assert.match(sql, new RegExp('runtime_can_' + operation));
  }
  assert.match(sql, /p\.polcmd IN \('a', '\*'\)/);
  assert.match(sql, /p\.polcmd IN \('w', '\*'\)/);
  assert.match(sql, /p\.polcmd IN \('d', '\*'\)/);
  assert.match(sql, /canonical_selection_unique_key_ready/);
  assert.match(sql, /i\.indisunique AND i\.indisvalid/);
  assert.match(sql, /i\.indpred IS NULL AND i\.indexprs IS NULL/);
  assert.match(sql, /i\.indnkeyatts = 3/);
  assert.match(sql, /WITH ORDINALITY AS k\(attnum, key_position\)/);
  assert.match(sql, /k\.key_position <= i\.indnkeyatts/);
  for (const column of ['user_id', 'selection_kind', 'political_office_id']) {
    assert.match(sql, new RegExp("'"+column+"'"));
  }
  assert.match(sql, /cardinality\(missing_columns\) > 0/);
  const requiredColumns = [...sql.matchAll(/\('([a-z_]+)',\s*'([a-z_]+)'\)/g)]
    .map((match) => match[1] + '.' + match[2]);
  for (const key of [
    'users.cognome', 'users.paese_residenza', 'users.provincia_residenza',
    'political_selections.jurisdiction_id', 'political_selections.political_office_id',
    'political_selections.selected_mandate_id', 'political_selections.context',
    'unita_elettorale_territorio.territory_code',
  ]) {
    assert.ok(requiredColumns.includes(key), 'missing staging column gate: ' + key);
  }
  assert.equal(new Set(requiredColumns).size, requiredColumns.length);
  assert.match(sql, /has_table_privilege\('demos_staging_runtime'/);
  assert.match(sql, /BLOCKED_NO_SELECT_GRANT/);
  assert.match(sql, /BLOCKED_MISSING_RELATION/);
  assert.match(sql, /METADATA_PASS_NOT_E2E_GO/);
  // Privilege names appear as SQL string literals; they are not statements.
  const withoutStringLiterals = sql.replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(withoutStringLiterals, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY|DO|CALL|CREATE)\b/i);
  assert.doesNotMatch(sql, /\b(?:FROM|JOIN)\s+(?:public\.)?(?:users|user_consents|political_selections|political_candidacies|political_mandates)\b/i);
});
