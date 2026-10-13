const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildUnitCode,
  loadElectionUnitManifest,
  loadElectionPerimeterManifest,
  validateElectionUnitManifest,
  validateElectionPerimeterManifest,
  getElectionUnitSchemaStatus,
  validateEventForElectionUnitSource,
  ingestItalianElectionUnitSnapshot,
} = require('../services/italianElectionUnitIngestionService');
const { getItalianElectionUnitSource } = require('../config/italianElectionUnitSources');

const SOURCE_ID = 'POLITICHE_20220925';
const EVENT_ID = '11111111-1111-4111-8111-111111111111';

function schemaRow() {
  return { rows: [{ events_table: 'eventi', units_table: 'unita_elettorale', mappings_table: 'unita_elettorale_territorio' }] };
}

function validEventRow() {
  return { rows: [{
    id: EVENT_ID,
    tipologia_evento: 'Elezioni',
    tipo_elezione: 'Politiche_nazionali',
    giorno_inizio: '2022-09-25',
    giorno_fine: '2022-09-25',
  }] };
}

test('official DAIT snapshot contains only minimized electoral-unit data and exact 2022 unit counts', () => {
  const manifest = loadElectionUnitManifest(SOURCE_ID);
  const source = getItalianElectionUnitSource(SOURCE_ID);
  const validation = validateElectionUnitManifest(manifest, source);
  assert.equal(validation.unitCount, 296);
  assert.equal(validation.counts.get('it.camera:UNINOMINAL'), 147);
  assert.equal(validation.counts.get('it.camera:PLURINOMINAL'), 49);
  assert.equal(validation.counts.get('it.senato:UNINOMINAL'), 74);
  assert.equal(validation.counts.get('it.senato:PLURINOMINAL'), 26);
  assert.equal(manifest.mappingComplete, false);
  const serialized = JSON.stringify(manifest).toUpperCase();
  assert.doesNotMatch(serialized, /"CANDIDATO"|"DATA_NASCITA"|"LUOGO_NASCITA"|"DESCR_LISTA"/);
});

test('official legal perimeter covers all 296 DAIT units without empty mappings', () => {
  const unitManifest = loadElectionUnitManifest(SOURCE_ID);
  const perimeter = loadElectionPerimeterManifest(SOURCE_ID);
  const source = getItalianElectionUnitSource(SOURCE_ID);
  const validation = validateElectionPerimeterManifest(perimeter, source, unitManifest);
  assert.equal(validation.unitCount, 296);
  assert.equal(validation.mappingCount, perimeter.counts.totalMappings);
  assert.equal(perimeter.mappingComplete, true);
  assert.ok(perimeter.units.every((unit) => unit.mappingComplete === true && unit.territories.length > 0));
});

test('every official unit receives a stable unique event-scoped import code', () => {
  const manifest = loadElectionUnitManifest(SOURCE_ID);
  const codes = manifest.units.map((unit) => buildUnitCode(SOURCE_ID, unit));
  assert.equal(new Set(codes).size, 296);
  assert.ok(codes.every((code) => code.startsWith('DAIT:POLITICHE_20220925:')));
});

test('official source metadata pins all four DAIT CSV hashes and URLs', () => {
  const manifest = loadElectionUnitManifest(SOURCE_ID);
  assert.equal(manifest.sources.length, 4);
  for (const source of manifest.sources) {
    assert.match(source.url, /^https:\/\/dait\.interno\.gov\.it\/documenti\/trasparenza\/POLITICHE_20220925\//);
    assert.match(source.sha256, /^[A-F0-9]{64}$/);
    assert.ok(source.rowCount > source.uniqueUnitCount);
  }
});

test('ingestion is inert before the canonical electoral-unit schema exists', async () => {
  const db = { query: async (sql) => {
    assert.match(String(sql), /to_regclass\('public\.unita_elettorale'\)/);
    return { rows: [{ events_table: 'eventi', units_table: null, mappings_table: null }] };
  } };
  const status = await getElectionUnitSchemaStatus(db);
  assert.equal(status.available, false);
  const result = await ingestItalianElectionUnitSnapshot({ db, eventId: EVENT_ID, sourceId: SOURCE_ID });
  assert.deepEqual(result, {
    available: false,
    sourceId: SOURCE_ID,
    eventId: EVENT_ID,
    units: 0,
    mappings: 0,
    reason: 'CAPABILITY_SCHEMA_REQUIRED',
  });
});

test('source can only attach to the matching national election event and date', async () => {
  const goodDb = { query: async (sql) => {
    if (/FROM eventi WHERE id/.test(String(sql))) return validEventRow();
    throw new Error(`unexpected query: ${sql}`);
  } };
  const validated = await validateEventForElectionUnitSource(goodDb, { eventId: EVENT_ID, sourceId: SOURCE_ID });
  assert.deepEqual(validated.officeIds.sort(), ['it.camera', 'it.senato']);

  const badDateDb = { query: async () => ({ rows: [{ ...validEventRow().rows[0], giorno_inizio: '2026-11-15' }] }) };
  await assert.rejects(
    () => validateEventForElectionUnitSource(badDateDb, { eventId: EVENT_ID, sourceId: SOURCE_ID }),
    (error) => error.code === 'ELECTION_SOURCE_EVENT_DATE_MISMATCH'
  );
});

test('snapshot ingestion upserts 296 units and the complete legal perimeter in source-scoped batches', async () => {
  const perimeter = loadElectionPerimeterManifest(SOURCE_ID);
  let unitCounter = 0;
  const calls = [];
  const db = { query: async (sql, params) => {
    const text = String(sql);
    calls.push({ text, params });
    if (/to_regclass/.test(text)) return schemaRow();
    if (/FROM eventi WHERE id/.test(text)) return validEventRow();
    if (/INSERT INTO unita_elettorale \(/.test(text)) {
      unitCounter += 1;
      return { rows: [{ id: `unit-${unitCounter}` }], rowCount: 1 };
    }
    if (/DELETE FROM unita_elettorale_territorio/.test(text)) return { rows: [], rowCount: 0 };
    if (/INSERT INTO unita_elettorale_territorio/.test(text)) return { rows: [], rowCount: 1 };
    throw new Error(`unexpected query: ${text}`);
  } };
  const result = await ingestItalianElectionUnitSnapshot({ db, eventId: EVENT_ID, sourceId: SOURCE_ID });
  assert.equal(result.available, true);
  assert.equal(result.units, 296);
  assert.equal(result.mappings, perimeter.counts.totalMappings);
  assert.equal(result.mappingComplete, true);
  assert.equal(result.eligibilityReadyUnits, 254);
  assert.equal(result.eligibilityResolutionComplete, false);
  assert.equal(result.sourceVerified, false);
  assert.equal(calls.filter((call) => /INSERT INTO unita_elettorale \(/.test(call.text)).length, 296);
  assert.equal(calls.filter((call) => /INSERT INTO unita_elettorale_territorio/.test(call.text)).length, 296);
  const metadata = JSON.parse(calls.find((call) => /INSERT INTO unita_elettorale \(/.test(call.text)).params[4]);
  assert.equal(metadata.mappingComplete, true);
  assert.equal(metadata.mappingAuthorityRequired, true);
  assert.match(metadata.perimeterLegalBasis, /decreto legislativo 23 dicembre 2020, n\. 177/i);
});

test('a source/event type mismatch fails closed before any unit write', async () => {
  let writes = 0;
  const db = { query: async (sql) => {
    const text = String(sql);
    if (/to_regclass/.test(text)) return schemaRow();
    if (/FROM eventi WHERE id/.test(text)) return { rows: [{ ...validEventRow().rows[0], tipo_elezione: 'Regionali' }] };
    if (/INSERT INTO unita_elettorale/.test(text)) writes += 1;
    return { rows: [] };
  } };
  await assert.rejects(
    () => ingestItalianElectionUnitSnapshot({ db, eventId: EVENT_ID, sourceId: SOURCE_ID }),
    (error) => error.code === 'ELECTION_SOURCE_EVENT_TYPE_MISMATCH'
  );
  assert.equal(writes, 0);
});
