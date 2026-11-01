'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname,'..','staging',file),'utf8');

const fixture = read('f12_poe_isolated_synthetic_20261029.sql');
const hardening = read('f12_poe_isolated_synthetic_index_20261029.sql');
const smoke = read('f12_poe_readonly_smoke_20261029.sql');
const canonicalProfile = read('f12_poe_canonical_profile_fixture_20261029.sql');

test('POE staging fixture is private and synthetic, never mutates public account tables', () => {
  assert.match(fixture, /CREATE SCHEMA f12_poe_ci/);
  assert.match(fixture, /REVOKE ALL ON SCHEMA f12_poe_ci FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(fixture, /REVOKE ALL ON ALL TABLES IN SCHEMA f12_poe_ci FROM PUBLIC, anon, authenticated, service_role/);
  assert.equal((fixture.match(/ENABLE ROW LEVEL SECURITY/g)||[]).length,3);
  for (const sql of [fixture,hardening,smoke]) {
    assert.doesNotMatch(sql, /\b(?:UPDATE|INSERT INTO|DELETE FROM|ALTER TABLE|DROP TABLE|TRUNCATE)\s+(?:public\.)?users\b/i);
    assert.doesNotMatch(sql, /\b(?:UPDATE|INSERT INTO|DELETE FROM|ALTER TABLE|DROP TABLE)\s+auth\./i);
    assert.doesNotMatch(sql, /\bSECURITY DEFINER\b/i);
  }
  assert.doesNotMatch(fixture, /\b(?:email|cognome|password|fiscal_number)\b\s+(?:text|varchar|character varying)/i);
});

test('staging P/O/E fixture preserves role/status namespaces and provenance gate', () => {
  assert.match(fixture, /CHECK\s*\(account_type IN \('P','O','E'\)\)/);
  assert.match(fixture, /ALTER COLUMN account_type SET DEFAULT 'P'/);
  assert.match(fixture, /ruolo varchar\(3\) NOT NULL DEFAULT 'E'/);
  assert.match(fixture, /status varchar\(20\) NOT NULL DEFAULT 'pending'/);
  assert.match(fixture, /source<>'LEGACY_BACKFILL'/);
  assert.match(fixture, /WHEN v_old='CP'/);
  assert.match(fixture, /WHEN v_old='P'/);
  assert.match(smoke, /legacy_politicians_not_verified/);
  assert.match(smoke, /account_role_domains_distinct/);
});

test('staging fixtures have usable indexes and deny API access by default', () => {
  assert.match(hardening,/PRIMARY KEY\(user_id,source,starts_at\)/);
  assert.match(hardening,/RLS enabled with intentionally NO policies/);
  for(const role of ['anon','authenticated','service_role']) {
    assert.match(smoke,new RegExp('has_schema_privilege\\(\\x27'+role+'\\x27'));
  }
  assert.doesNotMatch(fixture, /\bGRANT\b.*\b(?:anon|authenticated|service_role)\b/i);
});

test('private staging canonical profile fixture cannot expose production tables or identities', () => {
  assert.match(canonicalProfile,/CREATE TABLE f12_poe_ci\.user_profile/);
  assert.match(canonicalProfile,/CREATE TABLE f12_poe_ci\.user_representatives/);
  assert.match(canonicalProfile,/ALTER TABLE f12_poe_ci\.user_profile ENABLE ROW LEVEL SECURITY/);
  assert.match(canonicalProfile,/ALTER TABLE f12_poe_ci\.user_representatives ENABLE ROW LEVEL SECURITY/);
  assert.match(canonicalProfile,/REVOKE ALL ON ALL TABLES IN SCHEMA f12_poe_ci FROM PUBLIC,anon,authenticated,service_role/);
  assert.match(canonicalProfile,/has_schema_privilege\('service_role','f12_poe_ci','USAGE'\)/);
  assert.match(canonicalProfile,/AND is_dpo=true AND is_admin=false/);
  assert.match(canonicalProfile,/COALESCE\(ur\.rappresentante_camera,u\.rappresentante_camera\)='synthetic-choice'/);
  assert.doesNotMatch(canonicalProfile,/\b(?:ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM|DROP TABLE|CREATE TABLE)\s+(?:public|auth|storage)\./i);
  assert.doesNotMatch(canonicalProfile,/\bGRANT\s+\w+\s+ON\b/i);
});
