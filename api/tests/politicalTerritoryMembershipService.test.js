const test = require('node:test');
const assert = require('node:assert/strict');

const {
  territoryContextFromMemberships,
  loadUserPoliticalTerritoryState,
  loadUserElectoralUnitMemberships,
  chooseEligibleUnitsWithMemberships,
} = require('../services/politicalTerritoryMembershipService');
const { TERRITORY_SCOPES } = require('../services/politicalJurisdictionRegistryService');

test('canonical territory memberships build generic admin and municipal context', () => {
  const context = territoryContextFromMemberships([
    { territory_type: 'COUNTRY', territory_code: 'US' },
    { territory_type: 'ADMIN_LEVEL_1', territory_code: 'CA' },
    { territory_type: 'ADMIN_LEVEL_2', territory_code: 'Los Angeles County' },
    { territory_type: 'MUNICIPALITY', territory_code: 'Los Angeles' },
    { territory_type: 'ELECTORAL_DISTRICT', territory_code: 'CA-34' },
  ]);
  assert.deepEqual(context[TERRITORY_SCOPES.COUNTRY], ['us']);
  assert.deepEqual(context[TERRITORY_SCOPES.ADMIN_LEVEL_1], ['ca']);
  assert.deepEqual(context[TERRITORY_SCOPES.REGION], ['ca']);
  assert.deepEqual(context[TERRITORY_SCOPES.ELECTORAL_DISTRICT], ['ca-34']);
});

test('existing canonical territory table is authoritative even when no rows exist', async () => {
  const db = { query: async (sql) => {
    assert.match(String(sql), /FROM user_political_territories/);
    return { rows: [] };
  } };
  const state = await loadUserPoliticalTerritoryState(db, { userId: 'u1' });
  assert.equal(state.source, 'CANONICAL');
  assert.equal(state.strict, true);
  assert.deepEqual(state.memberships, []);
  assert.deepEqual(state.context[TERRITORY_SCOPES.COUNTRY], []);
});

test('missing canonical territory table falls back to legacy residence only', async () => {
  let calls = 0;
  const db = { query: async (sql) => {
    calls += 1;
    if (calls === 1) { const error = new Error('missing'); error.code = '42P01'; throw error; }
    assert.match(String(sql), /FROM users u\s+LEFT JOIN user_profile p ON p\.user_id = u\.id/);
    assert.match(String(sql), /COALESCE\(p\.comune_residenza, u\.comune_residenza\)/);
    return { rows: [{ paese_residenza: 'IT', regione_residenza: 'TO', provincia_residenza: 'PI', comune_residenza: 'Pisa' }] };
  } };
  const state = await loadUserPoliticalTerritoryState(db, { userId: 'u1' });
  assert.equal(state.source, 'LEGACY');
  assert.equal(state.strict, false);
  assert.deepEqual(state.context[TERRITORY_SCOPES.MUNICIPALITY], ['pisa']);
});

test('office-scoped electoral-unit memberships are loaded canonically', async () => {
  const db = { query: async (sql, params) => {
    assert.match(String(sql), /FROM user_electoral_unit_memberships/);
    assert.deepEqual(params, ['u1', ['e1'], 'us.house']);
    return { rows: [{ election_event_id: 'e1', electoral_unit_id: 'house-34', political_office_id: 'us.house' }] };
  } };
  const state = await loadUserElectoralUnitMemberships(db, { userId: 'u1', eventIds: ['e1'], officeId: 'us.house' });
  assert.equal(state.available, true);
  assert.equal(state.memberships[0].electoral_unit_id, 'house-34');
});

test('explicit electoral-unit membership overrides a broader matching territory for the same event', () => {
  const context = territoryContextFromMemberships([
    { territory_type: 'ADMIN_LEVEL_1', territory_code: 'CA' },
    { territory_type: 'ELECTORAL_DISTRICT', territory_code: 'CA-34' },
  ]);
  const mappings = [
    { election_event_id: 'e1', electoral_unit_id: 'house-34', territory_type: 'ELECTORAL_DISTRICT', territory_code: 'CA-34' },
    { election_event_id: 'e1', electoral_unit_id: 'statewide', territory_type: 'ADMIN_LEVEL_1', territory_code: 'CA' },
  ];
  const eligible = chooseEligibleUnitsWithMemberships(mappings, context, [
    { election_event_id: 'e1', electoral_unit_id: 'statewide', political_office_id: 'us.senate' },
  ]);
  assert.deepEqual([...eligible], ['e1:statewide']);
});

test('events without explicit membership still derive their most specific unit from canonical territories', () => {
  const context = territoryContextFromMemberships([
    { territory_type: 'REGION', territory_code: 'TO' },
    { territory_type: 'MUNICIPALITY', territory_code: 'Pisa' },
  ]);
  const eligible = chooseEligibleUnitsWithMemberships([
    { election_event_id: 'e1', electoral_unit_id: 'region', territory_type: 'REGION', territory_code: 'TO' },
    { election_event_id: 'e1', electoral_unit_id: 'city', territory_type: 'MUNICIPALITY', territory_code: 'Pisa' },
  ], context, []);
  assert.deepEqual([...eligible], ['e1:city']);
});


test('verified territory suppresses conflicting self-declared territory in the same scope', async () => {
  const db = { query: async () => ({ rows: [
    { jurisdiction_id: 'us', territory_type: 'ADMIN_LEVEL_1', territory_code: 'NV', verification_level: 'SELF_DECLARED' },
    { jurisdiction_id: 'us', territory_type: 'ADMIN_LEVEL_1', territory_code: 'CA', verification_level: 'VERIFIED' },
  ] }) };
  const state = await loadUserPoliticalTerritoryState(db, { userId: 'u1' });
  assert.deepEqual(state.context[TERRITORY_SCOPES.ADMIN_LEVEL_1], ['ca']);
});

test('official electoral membership suppresses lower-confidence conflicting unit for the same event and office', async () => {
  const db = { query: async () => ({ rows: [
    { election_event_id: 'e1', electoral_unit_id: 'unit-34', political_office_id: 'us.house', verification_level: 'SELF_DECLARED' },
    { election_event_id: 'e1', electoral_unit_id: 'unit-35', political_office_id: 'us.house', verification_level: 'OFFICIAL' },
  ] }) };
  const state = await loadUserElectoralUnitMemberships(db, { userId: 'u1', eventIds: ['e1'], officeId: 'us.house' });
  assert.deepEqual(state.memberships.map((row) => row.electoral_unit_id), ['unit-35']);
});


test('internal territory writer replaces only its own source/context and records verification level', async () => {
  const calls = [];
  const { replaceUserPoliticalTerritories } = require('../services/politicalTerritoryMembershipService');
  const db = { query: async (sql, params) => { calls.push({ sql: String(sql), params }); return { rows: [], rowCount: 1 }; } };
  const result = await replaceUserPoliticalTerritories(db, {
    userId: 'u1', jurisdictionId: 'us', officeId: 'us.house', source: 'official-resolver', verificationLevel: 'OFFICIAL',
    memberships: [{ territoryType: 'ELECTORAL_DISTRICT', territoryCode: 'CA-34', context: { cycle: 2026 } }],
  });
  assert.equal(result.written, 1);
  assert.equal(result.verificationLevel, 'OFFICIAL');
  assert.match(calls[0].sql, /source = \$4/);
  assert.match(calls[1].sql, /INSERT INTO user_political_territories/);
  assert.equal(calls[1].params[6], 'OFFICIAL');
});

test('internal electoral-unit writer deduplicates units and scopes replacement by event office and source', async () => {
  const calls = [];
  const { replaceUserElectoralUnitMemberships } = require('../services/politicalTerritoryMembershipService');
  const db = { query: async (sql, params) => { calls.push({ sql: String(sql), params }); return { rows: [], rowCount: 1 }; } };
  const result = await replaceUserElectoralUnitMemberships(db, {
    userId: 'u1', electionEventId: 'e1', officeId: 'us.house', source: 'state-board',
    electoralUnitIds: ['unit-34', 'unit-34'],
  });
  assert.equal(result.written, 1);
  assert.equal(result.verificationLevel, 'OFFICIAL');
  assert.match(calls[0].sql, /election_event_id = \$2/);
  assert.match(calls[0].sql, /political_office_id = \$3/);
  assert.match(calls[1].sql, /INSERT INTO user_electoral_unit_memberships/);
});


test('equal-authority conflicting territories fail closed instead of widening eligibility', async () => {
  const db = { query: async () => ({ rows: [
    { jurisdiction_id: 'us', territory_type: 'ADMIN_LEVEL_1', territory_code: 'CA', verification_level: 'VERIFIED', source: 'source-a' },
    { jurisdiction_id: 'us', territory_type: 'ADMIN_LEVEL_1', territory_code: 'NV', verification_level: 'VERIFIED', source: 'source-b' },
  ] }) };
  const state = await loadUserPoliticalTerritoryState(db, { userId: 'u1' });
  assert.deepEqual(state.context[TERRITORY_SCOPES.ADMIN_LEVEL_1], []);
  assert.equal(state.conflicts.length, 1);
  assert.deepEqual(state.conflicts[0].territoryCodes, ['CA', 'NV']);
});

test('same authoritative territory from multiple sources is deduplicated safely', async () => {
  const db = { query: async () => ({ rows: [
    { jurisdiction_id: 'it', territory_type: 'REGION', territory_code: 'TO', verification_level: 'VERIFIED', source: 'registry-a' },
    { jurisdiction_id: 'it', territory_type: 'REGION', territory_code: 'TO', verification_level: 'VERIFIED', source: 'registry-b' },
  ] }) };
  const state = await loadUserPoliticalTerritoryState(db, { userId: 'u1' });
  assert.equal(state.conflicts.length, 0);
  assert.equal(state.memberships.length, 1);
  assert.deepEqual(state.context[TERRITORY_SCOPES.REGION], ['to']);
});
