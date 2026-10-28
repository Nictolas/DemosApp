const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(__dirname, '..', 'database', 'create-account-capabilities-model.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

test('capability migration is additive and keeps legacy ruolo during transition', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS account_type/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS is_admin/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS is_activist/i);
  assert.doesNotMatch(sql, /DROP COLUMN\s+ruolo/i);
  assert.doesNotMatch(sql, /DROP TABLE\s+users/i);
});

test('capability migration creates relational candidacies and mandates with active indexes', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS political_candidacies/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS political_mandates/i);
  assert.match(sql, /idx_political_candidacies_user_active/i);
  assert.match(sql, /idx_political_mandates_user_active/i);
});

test('legacy P C CP data is backfilled without pretending a canonical election is known', () => {
  assert.match(sql, /LEGACY_BACKFILL/);
  assert.match(sql, /u\.ruolo IN \('C', 'CP'/);
  assert.match(sql, /u\.ruolo IN \('P', 'CP'/);
  assert.match(sql, /election_event_id UUID NULL/i);
  assert.match(sql, /electoral_unit_id UUID NULL/i);
});

test('legacy ruolo is explicitly maintained as a compatibility projection', () => {
  assert.match(sql, /refresh_users_legacy_role/);
  assert.match(sql, /political_candidacies_refresh_legacy_role/);
  assert.match(sql, /political_mandates_refresh_legacy_role/);
  assert.match(sql, /users_capabilities_refresh_legacy_role/);
});

test('account types are constrained to person institution organization', () => {
  assert.match(sql, /CHECK \(account_type IN \('PERSON', 'INSTITUTION', 'ORGANIZATION'\)\)/);
});


test('PostgreSQL function blocks keep valid dollar-quote delimiters', () => {
  const openings = (sql.match(/(?:DO|AS) \$\$/g) || []).length;
  const closings = (sql.match(/\$\$;/g) || []).length;
  assert.equal(closings, openings);
  assert.doesNotMatch(sql, /AS \$\n/);
});


test('capability migration rejects unverifiable legacy politicians before inventing ACTIVE mandates', () => {
  const uncommented = sql.split('\n').filter(x => !x.trimStart().startsWith('--')).join('\n');
  // Legacy P/CP is not evidence of a currently held office; fail-closed.
  assert.match(uncommented, /DO \$unverified_mandate_guard\$/);
  assert.match(uncommented, /unresolved_count > 0/);
  assert.match(uncommented, /RAISE EXCEPTION/);
  assert.match(uncommented, /NOT EXISTS \(\s*SELECT 1 FROM political_mandates pm/);
  assert.match(uncommented, /pm\.user_id = u\.id AND pm\.status = 'ACTIVE'/);
  assert.match(uncommented, /pm\.source <> 'LEGACY_BACKFILL'/);
  assert.match(uncommented, /pm\.starts_at IS NULL OR pm\.starts_at <= NOW\(\)/);
  assert.match(uncommented, /pm\.ends_at IS NULL OR pm\.ends_at > NOW\(\)/);
  assert.doesNotMatch(uncommented, /INSERT INTO political_mandates\s*\(/i);
  assert.match(uncommented, /BEGIN;/);
  assert.match(uncommented, /COMMIT;/);
});

test('legacy role refresh remains explicit and migration does not erase existing mandates', () => {
  const uncommented = sql.split('\n').filter(x => !x.trimStart().startsWith('--')).join('\n');
  assert.match(uncommented, /refresh_users_legacy_role/);
  assert.doesNotMatch(uncommented, /\bDELETE\s+FROM\s+political_mandates\b/i);
  assert.doesNotMatch(uncommented, /\bUPDATE\s+political_mandates\s+SET\b/i);
});
