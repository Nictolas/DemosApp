const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TERRITORY_PRIORITY,
  createTerritoryContext,
  jurisdictionMatchesScope,
  chooseMostSpecificEligibleUnits,
} = require('../services/politicalTerritoryService');
const { TERRITORY_SCOPES } = require('../services/politicalJurisdictionRegistryService');
const { eventGeographyMatches } = require('../services/electionEventService');

test('generic territory context maps admin levels and electoral districts independently', () => {
  const context = createTerritoryContext({
    country: ['US'],
    admin1: ['CA'],
    admin2: ['Los Angeles County'],
    municipality: ['Los Angeles'],
    electoralDistrict: ['CA-34'],
  });
  assert.deepEqual(context[TERRITORY_SCOPES.COUNTRY], ['us']);
  assert.deepEqual(context[TERRITORY_SCOPES.ADMIN_LEVEL_1], ['ca']);
  assert.deepEqual(context[TERRITORY_SCOPES.ELECTORAL_DISTRICT], ['ca-34']);
  assert.equal(jurisdictionMatchesScope({ state: 'CA' }, TERRITORY_SCOPES.ADMIN_LEVEL_1, context), true);
  assert.equal(jurisdictionMatchesScope({ district: 'CA-34' }, TERRITORY_SCOPES.ELECTORAL_DISTRICT, context), true);
});

test('electoral district beats broader state mapping for the same election', () => {
  assert.ok(TERRITORY_PRIORITY.ELECTORAL_DISTRICT < TERRITORY_PRIORITY.ADMIN_LEVEL_1);
  const context = createTerritoryContext({ country: ['US'], admin1: ['CA'], electoralDistrict: ['CA-34'] });
  const eligible = chooseMostSpecificEligibleUnits([
    { election_event_id: 'e1', electoral_unit_id: 'state', territory_type: 'ADMIN_LEVEL_1', territory_code: 'CA' },
    { election_event_id: 'e1', electoral_unit_id: 'district', territory_type: 'ELECTORAL_DISTRICT', territory_code: 'CA-34' },
  ], context);
  assert.deepEqual([...eligible], ['e1:district']);
});

test('mixed-scope US general election fails closed without electoral-unit mappings', () => {
  const user = {
    paese_residenza: 'US',
    regione_residenza: 'CA',
    provincia_residenza: 'Los Angeles County',
    comune_residenza: 'Los Angeles',
    electoral_districts: ['CA-34'],
  };
  assert.equal(eventGeographyMatches(user, { tipo_elezione: 'General Election', paese_evento: 'US' }), false);
});

test('single US House contest can match an explicit electoral district', () => {
  const user = {
    paese_residenza: 'US',
    regione_residenza: 'CA',
    comune_residenza: 'Los Angeles',
    electoral_districts: ['CA-34'],
  };
  assert.equal(eventGeographyMatches(user, {
    tipo_elezione: 'Congressional Election',
    paese_evento: 'US',
    electoral_district: 'CA-34',
  }), false, 'Congressional Election contains House and Senate contests and therefore still requires contest mappings');

  assert.equal(eventGeographyMatches(user, {
    tipo_elezione: 'US House',
    paese_evento: 'US',
    electoral_district: 'CA-34',
  }), true);
});
