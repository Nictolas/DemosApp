const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const migration = read('20261009_political_territory_memberships.sql');
const territoryService = read('api/services/politicalTerritoryMembershipService.js');
const eligibility = read('api/services/politicalEligibilityService.js');
const elections = read('api/services/electionEventService.js');
const erasure = read('api/services/privacyErasureLedgerService.js');

test('territory migration creates canonical geography and electoral-unit membership tables', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_political_territories/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_electoral_unit_memberships/);
  assert.match(migration, /political_office_id TEXT/);
  assert.match(migration, /verification_level TEXT NOT NULL/);
  assert.match(migration, /SELF_DECLARED.*VERIFIED.*OFFICIAL/s);
});

test('legacy residence is only a self-declared compatibility projection kept in sync by trigger', () => {
  assert.match(migration, /'legacy_profile'/);
  assert.match(migration, /'SELF_DECLARED'/);
  assert.match(migration, /CREATE TRIGGER users_sync_political_territories/);
  assert.match(migration, /AFTER INSERT OR UPDATE OF paese_residenza, regione_residenza, provincia_residenza, comune_residenza/);
});

test('canonical territory tables are private by default', () => {
  assert.match(migration, /ALTER TABLE user_political_territories ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE user_electoral_unit_memberships ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /CREATE POLICY/i);
});

test('eligibility and election relevance both consume the canonical territory membership service', () => {
  assert.match(eligibility, /politicalTerritoryMembershipService/);
  assert.match(eligibility, /loadUserPoliticalTerritoryState/);
  assert.match(eligibility, /loadUserElectoralUnitMemberships/);
  assert.match(elections, /politicalTerritoryMembershipService/);
  assert.match(elections, /loadUserPoliticalTerritoryState/);
  assert.match(elections, /loadUserElectoralUnitMemberships/);
});

test('legacy users residence query is isolated in the territory membership fallback service', () => {
  assert.match(territoryService, /FROM users WHERE id = \$1/);
  assert.doesNotMatch(eligibility, /SELECT id, paese_residenza, regione_residenza, provincia_residenza, comune_residenza/);
  assert.doesNotMatch(elections, /SELECT id, paese_residenza, regione_residenza, provincia_residenza, comune_residenza/);
});

test('exact electoral-unit membership outranks inferred geography and writer entry points stay internal', () => {
  assert.match(territoryService, /chooseEligibleUnitsWithMemberships/);
  assert.match(territoryService, /replaceUserPoliticalTerritories/);
  assert.match(territoryService, /replaceUserElectoralUnitMemberships/);
  assert.match(territoryService, /OFFICIAL/);
  assert.doesNotMatch(read('api/routes/users/profile.js'), /user_electoral_unit_memberships/);
});

test('account erasure explicitly covers both canonical territorial relations', () => {
  assert.match(erasure, /\['user_political_territories', 'user_id'\]/);
  assert.match(erasure, /\['user_electoral_unit_memberships', 'user_id'\]/);
});


test('active membership uniqueness is source-aware so evidence layers can coexist', () => {
  assert.match(migration, /uq_user_political_territories_active[\s\S]*COALESCE\(political_office_id, ''\), source/);
  assert.match(migration, /uq_user_electoral_unit_memberships_active[\s\S]*political_office_id, source/);
});

test('equal-authority territorial conflicts are represented fail-closed by the shared service', () => {
  assert.match(territoryService, /resolveAuthoritativeTerritoryRows/);
  assert.match(territoryService, /conflicts/);
  assert.match(territoryService, /codes\.length > 1/);
});
