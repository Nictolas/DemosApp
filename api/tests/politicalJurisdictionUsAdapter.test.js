const test = require('node:test');
const assert = require('node:assert/strict');

const {
  JURISDICTIONS,
  TERRITORY_SCOPES,
  getPoliticalAdapter,
  resolvePoliticalOffice,
  resolveElectionType,
  resolveOpinionScope,
  getElectionResidenceScope,
  getElectionOfficeIds,
  getElectionContestDescriptors,
  getLegacySelectionFields,
  getLegacySelectionField,
  getPodiumLevels,
  buildOfficePodiumCaseSql,
  validatePoliticalRegistry,
} = require('../services/politicalJurisdictionRegistryService');

test('shared jurisdiction registry includes USA without changing Italy/EU hierarchy', () => {
  assert.equal(JURISDICTIONS.it.parentId, 'eu');
  assert.equal(JURISDICTIONS.us.code, 'US');
  assert.equal(JURISDICTIONS.us.parentId, null);
});

test('US political adapter is a configuration module, not a new application fork', () => {
  const adapter = getPoliticalAdapter('us');
  assert.equal(adapter?.jurisdictionId, 'us');
  assert.ok(adapter.officeIds.includes('us.president'));
  assert.ok(adapter.officeIds.includes('us.house'));
  assert.ok(adapter.officeIds.includes('us.senate'));
  assert.ok(adapter.electionTypeIds.includes('US_GENERAL'));
});

test('office and Opinion resolution can be scoped by adapter', () => {
  assert.equal(resolvePoliticalOffice('Senate', { adapterId: 'us' })?.id, 'us.senate');
  assert.equal(resolvePoliticalOffice('Senato', { adapterId: 'it' })?.id, 'it.senato');
  assert.equal(resolvePoliticalOffice('House', { adapterId: 'us' })?.id, 'us.house');
  assert.equal(resolveOpinionScope('Federal', { adapterId: 'us' })?.id, 'US_FED');
  assert.equal(resolveOpinionScope('State', { adapterId: 'us' })?.id, 'US_STATE');
  assert.equal(resolveOpinionScope('Nazionale', { adapterId: 'it' })?.id, 'N');
});

test('US general election is modeled as mixed contests rather than one fake territory scope', () => {
  assert.equal(resolveElectionType('General Election', { adapterId: 'us' })?.id, 'US_GENERAL');
  assert.equal(getElectionResidenceScope('General Election', { adapterId: 'us' }), TERRITORY_SCOPES.CUSTOM);

  const contests = getElectionContestDescriptors('General Election', { adapterId: 'us' });
  const byId = Object.fromEntries(contests.map((contest) => [contest.id, contest]));
  assert.equal(byId['us.president'].residenceScope, TERRITORY_SCOPES.COUNTRY);
  assert.equal(byId['us.house'].residenceScope, TERRITORY_SCOPES.ELECTORAL_DISTRICT);
  assert.equal(byId['us.senate'].residenceScope, TERRITORY_SCOPES.ADMIN_LEVEL_1);
  assert.equal(byId['us.governor'].residenceScope, TERRITORY_SCOPES.ADMIN_LEVEL_1);
  assert.equal(byId['us.mayor'].residenceScope, TERRITORY_SCOPES.MUNICIPALITY);
});

test('US congressional election proves House and Senate cannot share one territorial rule', () => {
  assert.deepEqual(
    getElectionOfficeIds('Congressional Election', { adapterId: 'us' }),
    ['us.house', 'us.senate']
  );
  assert.equal(getElectionResidenceScope('Congressional Election', { adapterId: 'us' }), TERRITORY_SCOPES.CUSTOM);
});

test('US adapter does not leak into Italian legacy DB columns or Podio projection', () => {
  assert.equal(getLegacySelectionField('representative', 'Senate', { adapterId: 'us' }), null);
  assert.deepEqual(getLegacySelectionFields('representative'), [
    'rappresentante_europeo',
    'rappresentante_camera',
    'rappresentante_senato',
    'rappresentante_regionale',
    'rappresentante_comune',
  ]);
  assert.deepEqual(getPodiumLevels(), ['EUROPEO', 'CAMERA', 'SENATO', 'REGIONE', 'COMUNE']);
  const sql = buildOfficePodiumCaseSql('pm.office_code');
  assert.doesNotMatch(sql, /undefined/);
  assert.doesNotMatch(sql, /USPRESIDENT|USHOUSE|USSENATE/);
});

test('political registry remains internally consistent with two national adapters', () => {
  const validation = validatePoliticalRegistry();
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.deepEqual(validation.errors, []);
});
