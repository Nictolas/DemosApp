const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getTerritoryResolver,
  listTerritoryResolvers,
  validateResolverRegistry,
  loadIstatCatalog,
  resolveItalianAdministrativeRecord,
  buildItalianAdministrativeMemberships,
  persistItalianAdministrativeResolution,
  persistOfficialElectoralUnitResolution,
} = require('../services/politicalTerritoryResolverService');

const EVENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const UNIT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

test('territory resolver registry separates official catalog validation from event-scoped electoral authority', () => {
  const validation = validateResolverRegistry();
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  const istat = getTerritoryResolver('it.istat.situas');
  const eligendo = getTerritoryResolver('it.interno.eligendo');
  assert.equal(istat.membershipVerificationLevel, 'VERIFIED');
  assert.equal(istat.eventScoped, false);
  assert.equal(eligendo.membershipVerificationLevel, 'OFFICIAL');
  assert.equal(eligendo.eventScoped, true);
  assert.equal(listTerritoryResolvers('it').length, 3);
});

test('Istat snapshot is official, date-pinned and contains the current 7,894 municipalities', () => {
  const catalog = loadIstatCatalog();
  assert.equal(catalog.sourceId, 'it.istat.situas');
  assert.equal(catalog.referenceDate, '2026-10-09');
  assert.equal(catalog.generatedFromOfficialSnapshot, true);
  assert.equal(catalog.count, 7894);
  assert.equal(catalog.municipalities.length, 7894);
});

test('Italian resolver normalizes legacy Toscana/Pisa/San Giuliano Terme to stable Istat codes', () => {
  const resolution = resolveItalianAdministrativeRecord({
    paese_residenza: 'IT',
    regione_residenza: 'TO',
    provincia_residenza: 'PI',
    comune_residenza: 'San Giuliano Terme',
  });
  assert.equal(resolution.resolved, true);
  assert.equal(resolution.record.regionCode, '09');
  assert.equal(resolution.record.admin2Code, '050');
  assert.equal(resolution.record.municipalityCode, '050031');
  assert.equal(resolution.record.cadastralCode, 'A562');
});

test('Italian resolver also accepts the official municipality or cadastral code', () => {
  const byMunicipality = resolveItalianAdministrativeRecord({ municipalityCode: '050026', country: 'IT' });
  const byCadastral = resolveItalianAdministrativeRecord({ cadastralCode: 'G702', country: 'Italia' });
  assert.equal(byMunicipality.record.municipalityName, 'Pisa');
  assert.equal(byCadastral.record.municipalityCode, '050026');
});

test('Italian resolver fails closed for another country or an unknown municipality', () => {
  assert.equal(resolveItalianAdministrativeRecord({ country: 'US', municipality: 'Pisa' }).reason, 'COUNTRY_NOT_ITALY');
  assert.equal(resolveItalianAdministrativeRecord({ country: 'IT', municipality: 'Comune che non esiste' }).reason, 'NO_OFFICIAL_MATCH');
});

test('administrative memberships use generic stable scopes and preserve official provenance', () => {
  const resolution = resolveItalianAdministrativeRecord({ country: 'IT', municipality: 'Pisa', province: 'PI', region: 'Toscana' });
  const memberships = buildItalianAdministrativeMemberships(resolution);
  assert.deepEqual(memberships.map((m) => [m.territoryType, m.territoryCode]), [
    ['COUNTRY', 'IT'],
    ['ADMIN_LEVEL_1', '09'],
    ['ADMIN_LEVEL_2', '050'],
    ['MUNICIPALITY', '050026'],
  ]);
  assert.equal(memberships[3].context.resolverId, 'it.istat.situas');
  assert.equal(memberships[3].context.referenceDate, '2026-10-09');
});

test('persisting an Istat-normalized profile writes VERIFIED rather than falsely claiming official residence', async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push({ sql: String(sql), params }); return { rows: [], rowCount: 1 }; } };
  const result = await persistItalianAdministrativeResolution(db, {
    userId: '11111111-1111-1111-1111-111111111111',
    profile: { country: 'IT', region: 'TO', province: 'PI', municipality: 'Pisa' },
  });
  assert.equal(result.resolved, true);
  assert.equal(result.verificationLevel, 'VERIFIED');
  assert.equal(result.written, 4);
  const inserts = calls.filter((call) => /INSERT INTO user_political_territories/.test(call.sql));
  assert.equal(inserts.length, 4);
  assert.ok(inserts.every((call) => call.params[5] === 'it.istat.situas'));
  assert.ok(inserts.every((call) => call.params[6] === 'VERIFIED'));
});

test('official electoral resolution validates event and electoral unit before persisting OFFICIAL membership', async () => {
  const calls = [];
  const db = { query: async (sql, params) => {
    calls.push({ sql: String(sql), params });
    if (/FROM eventi WHERE id/.test(sql)) return { rows: [{ id: EVENT_ID, tipologia_evento: 'Elezioni', tipo_elezione: 'Politiche_nazionali' }] };
    if (/FROM unita_elettorale WHERE evento_id/.test(sql)) return { rows: [{ id: UNIT_ID }] };
    return { rows: [], rowCount: 1 };
  } };
  const result = await persistOfficialElectoralUnitResolution(db, {
    userId: '11111111-1111-1111-1111-111111111111',
    electionEventId: EVENT_ID,
    officeId: 'it.camera',
    electoralUnitIds: [UNIT_ID, UNIT_ID],
    evidence: { officialRecordId: 'test-record' },
  });
  assert.equal(result.resolverId, 'it.interno.eligendo');
  assert.equal(result.verificationLevel, 'OFFICIAL');
  assert.deepEqual(result.electoralUnitIds, [UNIT_ID]);
  const insert = calls.find((call) => /INSERT INTO user_electoral_unit_memberships/.test(call.sql));
  assert.equal(insert.params[4], 'it.interno.eligendo');
  assert.equal(insert.params[5], 'OFFICIAL');
});

test('official electoral resolver refuses an office that does not belong to the event', async () => {
  const db = { query: async (sql) => {
    if (/FROM eventi WHERE id/.test(sql)) return { rows: [{ id: EVENT_ID, tipologia_evento: 'Elezioni', tipo_elezione: 'Regionali' }] };
    throw new Error('unit lookup must not run');
  } };
  await assert.rejects(
    persistOfficialElectoralUnitResolution(db, {
      userId: 'u1', electionEventId: EVENT_ID, officeId: 'it.camera', electoralUnitIds: [UNIT_ID],
    }),
    (error) => error.code === 'TERRITORY_RESOLVER_EVENT_OFFICE_MISMATCH',
  );
});
