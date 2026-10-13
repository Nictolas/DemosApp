const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TERRITORY_SCOPES,
  normalizeElectionType,
  normalizeOpinionScope,
  getOpinionScopeLabel,
  resolvePoliticalOffice,
  getElectionResidenceScope,
  getLegacySelectionField,
  getLegacySelectionFields,
  getLegacySelectionFieldsForElectionType,
  getSelectionFieldContract,
  getOpinionGradeForOffice,
  getPodiumLevels,
  buildOfficePodiumCaseSql,
  validatePoliticalRegistry,
} = require('../services/politicalJurisdictionRegistryService');

test('political jurisdiction registry is internally consistent', () => {
  const result = validatePoliticalRegistry();
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('Italian legacy office aliases resolve through one registry', () => {
  assert.equal(resolvePoliticalOffice('C')?.id, 'it.camera');
  assert.equal(resolvePoliticalOffice('Camera dei Deputati')?.id, 'it.camera');
  assert.equal(resolvePoliticalOffice('SENATO')?.id, 'it.senato');
  assert.equal(resolvePoliticalOffice('R')?.id, 'it.regional');
  assert.equal(resolvePoliticalOffice('comunale')?.id, 'it.municipal');
  assert.equal(resolvePoliticalOffice('europeo')?.id, 'eu.parliament.it');
});

test('election aliases normalize independently from office aliases', () => {
  assert.equal(normalizeElectionType('Politiche_nazionali'), 'NATIONAL');
  assert.equal(normalizeElectionType('Regionali'), 'REGIONAL');
  assert.equal(normalizeElectionType('Comunali'), 'MUNICIPAL');
  assert.equal(normalizeElectionType('Europee Parlamento'), 'EUROPEAN');
  assert.equal(getElectionResidenceScope('Regionali'), TERRITORY_SCOPES.REGION);
  assert.equal(getElectionResidenceScope('Comunali'), TERRITORY_SCOPES.MUNICIPALITY);
});

test('opinion scopes are registry-driven and independent from single offices', () => {
  assert.equal(normalizeOpinionScope('Europeo'), 'E');
  assert.equal(normalizeOpinionScope('Nazionale'), 'N');
  assert.equal(normalizeOpinionScope('Regional'), 'R');
  assert.equal(normalizeOpinionScope('Comunale'), 'CO');
  assert.equal(getOpinionScopeLabel('N'), 'Nazionale');
  assert.equal(getOpinionScopeLabel('CO'), 'Comunale');
});

test('legacy selection fields and opinion grades derive from office definitions', () => {
  assert.equal(getLegacySelectionField('representative', 'CAMERA'), 'rappresentante_camera');
  assert.equal(getLegacySelectionField('candidate', 'S'), 'candidato_senato');
  assert.equal(getOpinionGradeForOffice('CAMERA'), 'N');
  assert.equal(getOpinionGradeForOffice('SENATO'), 'N');
  assert.equal(getOpinionGradeForOffice('REGIONE'), 'R');
  assert.equal(getOpinionGradeForOffice('COMUNE'), 'CO');
  assert.equal(getSelectionFieldContract('candidato_camera')?.office.id, 'it.camera');
  assert.equal(getSelectionFieldContract('rappresentante_comune')?.kind, 'representative');
});

test('national election fallback targets both Italian parliamentary candidate slots', () => {
  assert.deepEqual(
    getLegacySelectionFieldsForElectionType('candidate', 'Politiche'),
    ['candidato_camera', 'candidato_senato']
  );
  assert.equal(getLegacySelectionFields('representative').length, 5);
  assert.equal(getLegacySelectionFields('candidate').length, 5);
});

test('Podio levels and SQL normalization derive from the same office aliases', () => {
  assert.deepEqual(getPodiumLevels(), ['EUROPEO', 'CAMERA', 'SENATO', 'REGIONE', 'COMUNE']);
  const sql = buildOfficePodiumCaseSql("pm.jurisdiction->>'level'");
  assert.match(sql, /regexp_replace/);
  assert.match(sql, /THEN 'CAMERA'/);
  assert.match(sql, /THEN 'SENATO'/);
  assert.match(sql, /THEN 'REGIONE'/);
  assert.match(sql, /THEN 'COMUNE'/);
});
