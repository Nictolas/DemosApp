const test = require('node:test');
const assert = require('node:assert/strict');
const { loadElectionPerimeterManifest } = require('../services/italianElectionUnitIngestionService');
const { createTerritoryContext, mappingMatchesTerritory, TERRITORY_PRIORITY } = require('../services/politicalTerritoryService');
const { TERRITORY_SCOPES } = require('../config/politicalJurisdictions');

const SOURCE_ID = 'POLITICHE_20220925';
const findUnit = (p, officeId, unitType, unitLabel) => p.units.find((u) =>
  u.officeId === officeId && u.unitType === unitType && u.unitLabel === unitLabel
);
const key = (t) => `${t.territoryType}|${t.territoryCode}`;

test('legal perimeter snapshot covers all 296 Camera and Senato units', () => {
  const p = loadElectionPerimeterManifest(SOURCE_ID);
  assert.equal(p.units.length, 296);
  assert.equal(p.mappingComplete, true);
  assert.equal(p.eligibilityResolutionComplete, false);
  assert.equal(p.counts.municipality, 31085);
  assert.equal(p.counts.subMunicipal, 668);
  assert.equal(p.counts.officialArea, 0);
  assert.equal(p.counts.totalMappings, 31753);
  assert.equal(p.counts.eligibilityReadyUnits, 254);
  assert.equal(p.units.filter((u) => u.officeId === 'it.camera' && u.unitType === 'UNINOMINAL').length, 147);
  assert.equal(p.units.filter((u) => u.officeId === 'it.camera' && u.unitType === 'PLURINOMINAL').length, 49);
  assert.equal(p.units.filter((u) => u.officeId === 'it.senato' && u.unitType === 'UNINOMINAL').length, 74);
  assert.equal(p.units.filter((u) => u.officeId === 'it.senato' && u.unitType === 'PLURINOMINAL').length, 26);
  assert.ok(p.units.every((u) => u.mappingComplete === true && u.territories.length > 0));
  assert.ok(p.units.flatMap((u) => u.territories).every((t) => ['MUNICIPALITY', 'SUB_MUNICIPAL_AREA'].includes(t.territoryType)));
});

test('election-day SITUAS roster is pinned and all used municipality codes are current for 2022-09-25', () => {
  const p = loadElectionPerimeterManifest(SOURCE_ID);
  assert.equal(p.municipalityReference.referenceDate, '2022-09-25');
  assert.equal(p.municipalityReference.rowCount, 7904);
  assert.equal(p.municipalityReference.codeRosterVerified, true);
  assert.equal(p.municipalityReference.usedMunicipalityCodesVerified, 7897);
  assert.match(p.municipalityReference.generatedRawSha256, /^[A-F0-9]{64}$/);
  assert.match(p.municipalityReference.lastVerifiedRawSha256, /^[A-F0-9]{64}$/);
});

test('Pisa and San Giuliano Terme resolve to stable Istat municipality codes', () => {
  const p = loadElectionPerimeterManifest(SOURCE_ID);
  const unit = findUnit(p, 'it.camera', 'UNINOMINAL', 'TOSCANA - U04');
  assert.ok(unit);
  assert.ok(unit.territories.some((t) => t.territoryType === 'MUNICIPALITY' && t.territoryCode === '050026' && t.label === 'Pisa'));
  assert.ok(unit.territories.some((t) => t.territoryType === 'MUNICIPALITY' && t.territoryCode === '050031' && t.label === 'San Giuliano Terme'));
});

test('the six split cities are evidence-only at sub-municipal level and never widened to the whole municipality', () => {
  const p = loadElectionPerimeterManifest(SOURCE_ID);
  const expected = new Map([
    ['063049', 'Napoli'], ['058091', 'Roma'], ['010025', 'Genova'],
    ['015146', 'Milano'], ['001272', 'Torino'], ['082053', 'Palermo'],
  ]);
  assert.deepEqual(new Map(p.subMunicipalResolutionRequired.map((x) => [x.municipalityCode, x.municipalityName])), expected);
  const uninominal = p.units.filter((u) => u.unitType === 'UNINOMINAL');
  for (const [municipalityCode] of expected) {
    assert.ok(!uninominal.some((u) => u.territories.some((t) => t.territoryType === 'MUNICIPALITY' && t.territoryCode === municipalityCode)));
    assert.ok(uninominal.some((u) => u.territories.some((t) => t.territoryType === 'SUB_MUNICIPAL_AREA' && t.parentMunicipalityCode === municipalityCode)));
  }
});

test('whole-municipality assignments are unique across uninominal districts of the same chamber', () => {
  const p = loadElectionPerimeterManifest(SOURCE_ID);
  for (const officeId of ['it.camera', 'it.senato']) {
    const seen = new Map();
    for (const unit of p.units.filter((u) => u.officeId === officeId && u.unitType === 'UNINOMINAL')) {
      for (const territory of unit.territories.filter((t) => t.territoryType === 'MUNICIPALITY')) {
        assert.ok(!seen.has(territory.territoryCode), `${officeId} ${territory.territoryCode} appears in ${seen.get(territory.territoryCode)} and ${unit.unitLabel}`);
        seen.set(territory.territoryCode, unit.unitLabel);
      }
    }
  }
});

test('plurinominal perimeters equal child-uninominal unions except the documented Law 84/2021 adjustment', () => {
  const p = loadElectionPerimeterManifest(SOURCE_ID);
  const allowedExtra = new Set(['MUNICIPALITY|099030', 'MUNICIPALITY|099031']);
  for (const unit of p.units.filter((u) => u.unitType === 'PLURINOMINAL')) {
    const children = p.units.filter((x) => x.officeId === unit.officeId && x.unitType === 'UNINOMINAL' && unit.childUnitLabels.includes(x.unitLabel));
    const childUnion = new Set(children.flatMap((x) => x.territories.map(key)));
    const own = new Set(unit.territories.map(key));
    const extra = [...own].filter((x) => !childUnion.has(x));
    const missing = [...childUnion].filter((x) => !own.has(x));
    assert.deepEqual(missing, []);
    if (extra.length) {
      assert.equal(unit.officeId, 'it.camera');
      assert.equal(unit.unitLabel, 'EMILIA-ROMAGNA - P03');
      assert.deepEqual(new Set(extra), allowedExtra);
    }
  }
  assert.equal(p.postDecreeAdjustments.length, 1);
  assert.match(p.postDecreeAdjustments[0].legalBasis, /Legge 28 maggio 2021, n\. 84/);
});

test('Montecopiolo and Sassofeltrio use the official 2022 post-decree assignments', () => {
  const p = loadElectionPerimeterManifest(SOURCE_ID);
  const codes = ['099030', '099031'];
  for (const [officeId, unitLabel] of [
    ['it.camera', 'EMILIA-ROMAGNA - U11'], ['it.camera', 'EMILIA-ROMAGNA - P03'],
    ['it.senato', 'EMILIA-ROMAGNA - U05'], ['it.senato', 'EMILIA-ROMAGNA - P02'],
  ]) {
    const unit = p.units.find((u) => u.officeId === officeId && u.unitLabel === unitLabel);
    assert.ok(unit);
    for (const code of codes) {
      const territory = unit.territories.find((t) => t.territoryType === 'MUNICIPALITY' && t.territoryCode === code);
      assert.ok(territory);
      assert.equal(territory.resolution, 'LAW_84_2021_EVENT_2022_ASSIGNMENT');
    }
  }
});

test('sub-municipal evidence cannot match an ordinary municipality residence', () => {
  const p = loadElectionPerimeterManifest(SOURCE_ID);
  const torino = findUnit(p, 'it.camera', 'UNINOMINAL', 'PIEMONTE 1 - U01');
  const evidence = torino.territories.find((t) => t.territoryType === 'SUB_MUNICIPAL_AREA');
  const context = createTerritoryContext({ municipality: ['001272'] });
  assert.equal(mappingMatchesTerritory({ territory_type: evidence.territoryType, territory_code: evidence.territoryCode }, context), false);
  assert.equal(TERRITORY_SCOPES.SUB_MUNICIPAL_AREA, 'SUB_MUNICIPAL_AREA');
  assert.equal(TERRITORY_PRIORITY.SUB_MUNICIPAL_AREA, undefined);
});
