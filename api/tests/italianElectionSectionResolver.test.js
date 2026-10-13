'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadElectionPerimeterManifest } = require('../services/italianElectionUnitIngestionService');
const {
  RESOLVER_ID,
  loadItalianElectionSectionSnapshot,
  municipalityRequiresSectionResolution,
  resolveItalianElectionUnitsBySection,
  persistItalianElectionSectionResolution,
} = require('../services/italianElectionSectionResolverService');

const SOURCE_ID = 'POLITICHE_20220925';

function membershipMap(result) {
  return new Map(result.memberships.map((m) => [`${m.officeId}|${m.unitType}`, m.unitLabel]));
}

test('official 2022 section snapshot covers all six split municipalities offline', () => {
  const snapshot = loadItalianElectionSectionSnapshot();
  assert.equal(snapshot.sourceId, SOURCE_ID);
  assert.equal(snapshot.electionDate, '2022-09-25');
  assert.equal(snapshot.generatedFromOfficialMunicipalSources, true);
  assert.equal(snapshot.counts.municipalities, 6);
  assert.equal(snapshot.counts.sections, 6909);
  assert.deepEqual(
    Object.fromEntries(Object.entries(snapshot.municipalities).map(([code, city]) => [code, city.sectionCount])),
    { '001272': 919, '015146': 1248, '010025': 656, '058091': 2602, '063049': 884, '082053': 600 },
  );
  assert.equal(Object.keys(snapshot.sources).length, 12);
  for (const source of Object.values(snapshot.sources)) {
    assert.match(source.url, /^https:\/\//);
    assert.match(source.sha256, /^[A-F0-9]{64}$/);
    assert.ok(source.bytes > 0);
  }
});

test('section resolver is event-scoped and fail-closed for split municipalities', () => {
  assert.equal(municipalityRequiresSectionResolution('001272'), true);
  assert.equal(municipalityRequiresSectionResolution('050026'), false);
  assert.equal(resolveItalianElectionUnitsBySection({ municipalityCode: '001272' }).reason, 'SECTION_REQUIRED_FOR_SPLIT_MUNICIPALITY');
  assert.equal(resolveItalianElectionUnitsBySection({ municipalityCode: '001272', sectionNumber: 'x' }).reason, 'SECTION_INVALID');
  assert.equal(resolveItalianElectionUnitsBySection({ municipalityCode: '001272', sectionNumber: 999999 }).reason, 'SECTION_NOT_FOUND');
  assert.equal(resolveItalianElectionUnitsBySection({ municipalityCode: '050026', sectionNumber: 1 }).reason, 'SECTION_NOT_REQUIRED_FOR_MUNICIPALITY');
  assert.equal(resolveItalianElectionUnitsBySection({ sourceId: 'POLITICHE_2027', municipalityCode: '001272', sectionNumber: 1 }).reason, 'ELECTION_SOURCE_NOT_SUPPORTED');
});

test('known official section samples resolve to Camera and Senato units', () => {
  const cases = [
    ['001272', 1, 'PIEMONTE 1 - U01', 'PIEMONTE - U01'],
    ['015146', 1, 'LOMBARDIA 1 - U09', 'LOMBARDIA - U03'],
    ['010025', 1, 'LIGURIA - U02', 'LIGURIA - U01'],
    ['058091', 1, 'LAZIO 1 - U02', 'LAZIO - U03'],
    ['063049', 1, 'CAMPANIA 1 - U02', 'CAMPANIA - U04'],
    ['082053', 1, 'SICILIA 1 - U01', 'SICILIA - U01'],
  ];
  for (const [municipalityCode, sectionNumber, cameraUnit, senateUnit] of cases) {
    const result = resolveItalianElectionUnitsBySection({ municipalityCode, sectionNumber });
    assert.equal(result.resolved, true, `${municipalityCode}/${sectionNumber}`);
    assert.equal(result.resolverId, RESOLVER_ID);
    assert.equal(result.verificationLevel, 'OFFICIAL');
    const memberships = membershipMap(result);
    assert.equal(memberships.get('it.camera|UNINOMINAL'), cameraUnit);
    assert.equal(memberships.get('it.senato|UNINOMINAL'), senateUnit);
    assert.match(memberships.get('it.camera|PLURINOMINAL'), / - P\d+$/);
    assert.match(memberships.get('it.senato|PLURINOMINAL'), / - P\d+$/);
  }
});

test('every section mapping points only to legal 2022 perimeter units and their legal parent', () => {
  const snapshot = loadItalianElectionSectionSnapshot();
  const perimeter = loadElectionPerimeterManifest(SOURCE_ID);
  const units = new Map(perimeter.units.map((u) => [`${u.officeId}|${u.unitType}|${u.unitLabel}`, u]));
  for (const [municipalityCode, city] of Object.entries(snapshot.municipalities)) {
    const seen = new Set();
    for (const [section, cameraU, cameraP, senatoU, senatoP] of city.sections) {
      assert.ok(!seen.has(section), `${municipalityCode}: duplicate section ${section}`);
      seen.add(section);
      for (const [officeId, uni, pluri] of [
        ['it.camera', cameraU, cameraP], ['it.senato', senatoU, senatoP],
      ]) {
        assert.ok(units.has(`${officeId}|UNINOMINAL|${uni}`), `${municipalityCode}/${section}: ${uni}`);
        const parent = units.get(`${officeId}|PLURINOMINAL|${pluri}`);
        assert.ok(parent, `${municipalityCode}/${section}: ${pluri}`);
        assert.ok(parent.childUnitLabels.includes(uni), `${municipalityCode}/${section}: ${uni} not child of ${pluri}`);
      }
    }
    assert.equal(seen.size, city.sectionCount);
  }
});

test('section snapshot closes all 42 legal units that municipality-only resolution could not resolve', () => {
  const snapshot = loadItalianElectionSectionSnapshot();
  const perimeter = loadElectionPerimeterManifest(SOURCE_ID);
  const required = new Set(perimeter.subMunicipalResolutionRequired.flatMap((city) =>
    city.units.map((unit) => `${unit.officeId}|${unit.unitType}|${unit.unitLabel}`)
  ));
  assert.equal(required.size, 42);
  const covered = new Set();
  for (const city of Object.values(snapshot.municipalities)) {
    for (const [, cameraU, cameraP, senatoU, senatoP] of city.sections) {
      covered.add(`it.camera|UNINOMINAL|${cameraU}`);
      covered.add(`it.camera|PLURINOMINAL|${cameraP}`);
      covered.add(`it.senato|UNINOMINAL|${senatoU}`);
      covered.add(`it.senato|PLURINOMINAL|${senatoP}`);
    }
  }
  for (const key of required) assert.ok(covered.has(key), `unresolved legal unit: ${key}`);
});


test('resolved section is persisted as four OFFICIAL event-scoped electoral memberships', async () => {
  const eventId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ids = {
    'it.camera|UNINOMINAL|PIEMONTE 1 - U01': '10000000-0000-0000-0000-000000000001',
    'it.camera|PLURINOMINAL|PIEMONTE 1 - P01': '10000000-0000-0000-0000-000000000002',
    'it.senato|UNINOMINAL|PIEMONTE - U01': '10000000-0000-0000-0000-000000000003',
    'it.senato|PLURINOMINAL|PIEMONTE - P01': '10000000-0000-0000-0000-000000000004',
  };
  const calls = [];
  const db = { query: async (sql, params = []) => {
    const text = String(sql);
    calls.push({ sql: text, params });
    if (/metadata->>'officeId' AS office_id/.test(text)) {
      return { rows: Object.entries(ids).map(([key, id]) => {
        const [office_id, unit_type, label] = key.split('|');
        return { id, office_id, unit_type, label };
      }) };
    }
    if (/FROM eventi WHERE id/.test(text)) {
      return { rows: [{ id: eventId, tipologia_evento: 'Elezioni', tipo_elezione: 'Politiche_nazionali' }] };
    }
    if (/FROM unita_elettorale WHERE evento_id/.test(text) && /id = ANY/.test(text)) {
      return { rows: (params[1] || []).map((id) => ({ id })) };
    }
    return { rows: [], rowCount: 1 };
  } };

  const result = await persistItalianElectionSectionResolution(db, {
    userId: '11111111-1111-1111-1111-111111111111',
    electionEventId: eventId,
    municipalityCode: '001272',
    sectionNumber: 1,
  });
  assert.equal(result.resolved, true);
  assert.equal(result.written, 4);
  const inserts = calls.filter((call) => /INSERT INTO user_electoral_unit_memberships/.test(call.sql));
  assert.equal(inserts.length, 4);
  assert.ok(inserts.every((call) => call.params[4] === RESOLVER_ID));
  assert.ok(inserts.every((call) => call.params[5] === 'OFFICIAL'));
  assert.ok(inserts.every((call) => JSON.parse(call.params[6]).sectionNumber === 1));
});
