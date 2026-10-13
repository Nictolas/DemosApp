const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const migration = fs.readFileSync(path.join(ROOT, '20261009_civic_processes.sql'), 'utf8');
const {
  normalizeCanonicalTitle,
  normalizeDate,
  normalizeOfficialIdentifiers,
  validateNormalizedSourceRecord,
} = require('../services/civicProcessPersistenceService');
const camera = require('../services/civicSources/italyCameraPopularInitiativesAdapter');
const senato = require('../services/civicSources/italySenatoPopularInitiativesAdapter');
const { mapItalianParliamentaryStage } = require('../services/civicSources/italyParliamentStage');

test('canonical civic persistence schema is jurisdiction-neutral and source-many', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS civic_processes/);
  assert.match(migration, /jurisdiction_id TEXT NOT NULL/);
  assert.match(migration, /process_type_id TEXT NOT NULL/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS civic_process_identifiers/);
  assert.match(migration, /UNIQUE \(namespace, value\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS civic_process_source_records/);
  assert.match(migration, /civic_process_id UUID NOT NULL REFERENCES civic_processes/);
  assert.match(migration, /UNIQUE \(source_id, external_id\)/);
  assert.doesNotMatch(migration, /camera_id|senato_id|ministero_id/i);
  for (const table of ['civic_processes', 'civic_process_identifiers', 'civic_process_source_records', 'civic_process_reconciliation_candidates']) {
    assert.match(migration, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
  }
});

test('title equality creates reconciliation candidates instead of an automatic unique title merge', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS civic_process_reconciliation_candidates/);
  assert.match(migration, /exact_normalized_title|reason TEXT NOT NULL/);
  assert.doesNotMatch(migration, /UNIQUE \(jurisdiction_id, process_type_id, normalized_title\)/);
});

test('canonical title normalization is deterministic but not itself an identity', () => {
  assert.equal(
    normalizeCanonicalTitle('  “Acqua pubblica”: una proposta!  '),
    'acqua pubblica una proposta'
  );
  assert.equal(normalizeDate('20261009'), '2026-10-09');
  assert.equal(normalizeDate('2026-10-09T12:30:00Z'), '2026-10-09');
  assert.deepEqual(normalizeOfficialIdentifiers([{namespace:'it.parliament.phase',value:'19:C:2841'},{namespace:'it.parliament.phase',value:'19:C:2841'}]), [{namespace:'it.parliament.phase',value:'19:C:2841'}]);
});

test('source records are rejected when source/process/jurisdiction do not agree', () => {
  assert.throws(() => validateNormalizedSourceRecord({
    jurisdictionId: 'eu',
    processTypeId: 'it.popular_law_initiative',
    sourceId: 'it.parliament.camera',
    externalId: 'x',
    title: 'Test',
  }), /PROCESS_JURISDICTION_MISMATCH/);
});

test('Camera adapter queries official popular bills in the selected legislature', () => {
  const query = camera.buildCameraPopularInitiativesQuery({ legislature: 19, limit: 25 });
  assert.match(query, /ocd:iniziativa "Popolare"/);
  assert.match(query, /dc:type "Progetto di Legge"/);
  assert.match(query, /legislatura\.rdf\/repubblica_19/);
  assert.match(query, /LIMIT 25/);
  assert.equal(camera.ENDPOINT, 'https://dati.camera.it/sparql');
  assert.equal(camera.decodeCameraText('l&rsquo;iniziativa'), 'l’iniziativa');
});

test('Camera binding normalizes to the canonical parliamentary source contract', () => {
  const record = camera.normalizeCameraBinding({
    atto: { value: 'http://dati.camera.it/ocd/attocamera.rdf/ac19_9999' },
    numero: { value: '9999' },
    titolo: { value: 'PROPOSTA DI LEGGE D’INIZIATIVA POPOLARE: Test' },
    data: { value: '20261009' },
    statoLabel: { value: 'Assegnato in Commissione' },
    scheda: { value: 'https://www.camera.it/example' },
  });
  assert.equal(record.sourceId, 'it.parliament.camera');
  assert.equal(record.processTypeId, 'it.popular_law_initiative');
  assert.equal(record.stageId, 'parliamentary_review');
  assert.equal(record.officialReference, null);
  assert.deepEqual(record.officialIdentifiers, [{ namespace: 'it.parliament.phase', value: '19:C:9999' }]);
});

test('Senato adapter filters initiative type Popolare and carries a strong shared iter reference', () => {
  const query = senato.buildSenatoPopularInitiativesQuery({ legislature: 19, limit: 20 });
  assert.match(query, /osr:tipoIniziativa \?tipoIniziativa/);
  assert.match(query, /LCASE\(STR\(\?tipoIniziativa\)\) = "popolare"/);
  assert.match(query, /osr:legislatura 19/);
  assert.equal(senato.ENDPOINT, 'https://dati.senato.it/sparql');

  const record = senato.normalizeSenatoBinding({
    ddl: { value: 'http://dati.senato.it/ddl/70000' },
    idDdl: { value: '60000' },
    ramo: { value: 'S' },
    numeroFase: { value: '1234' },
    titolo: { value: 'Iniziativa popolare di prova' },
    dataPresentazione: { value: '2026-10-01' },
    stato: { value: 'in corso' },
    dataStato: { value: '2026-10-09' },
    tipoIniziativa: { value: 'Popolare' },
  });
  assert.equal(record.sourceId, 'it.parliament.senate');
  assert.equal(record.officialReference, 'it:parliament:ddl:19:60000');
  assert.deepEqual(record.officialIdentifiers, [
    { namespace: 'it.parliament.iter', value: '19:60000' },
    { namespace: 'it.parliament.phase', value: '19:S:1234' },
  ]);
  assert.equal(record.stageId, 'parliamentary_review');
});

test('Camera and Senato can share a strong phase identifier without title matching', () => {
  const cameraRecord = camera.normalizeCameraBinding({
    atto: { value: 'http://dati.camera.it/ocd/attocamera.rdf/ac19_2841' },
    numero: { value: '2841' },
    titolo: { value: 'PROPOSTA DI LEGGE D’INIZIATIVA POPOLARE: Titolo esteso' },
  });
  const senateRecord = senato.normalizeSenatoBinding({
    ddl: { value: 'http://dati.senato.it/ddl/59984' },
    idDdl: { value: '55242' },
    ramo: { value: 'C' },
    numeroFase: { value: '2841' },
    titolo: { value: 'Titolo senza prefisso Camera' },
    tipoIniziativa: { value: 'Popolare' },
  });
  const cameraPhase = cameraRecord.officialIdentifiers.find(x => x.namespace === 'it.parliament.phase');
  const senatePhase = senateRecord.officialIdentifiers.find(x => x.namespace === 'it.parliament.phase');
  assert.deepEqual(cameraPhase, senatePhase);
  assert.notEqual(cameraRecord.title, senateRecord.title);
});

test('terminal parliamentary statuses map to closed lifecycle stage without deciding DEMOS priority', () => {
  for (const status of ['approvato', 'respinto', 'ritirato', 'decaduto', 'assorbito', 'Approvato definitivamente']) {
    assert.equal(mapItalianParliamentaryStage(status), 'closed', status);
  }
  assert.equal(mapItalianParliamentaryStage('in corso'), 'parliamentary_review');
  assert.equal(mapItalianParliamentaryStage(null), 'parliamentary_review');
});

test('canonical stage advancement uses per-process rank and cannot be downgraded by an earlier source phase', () => {
  const src = fs.readFileSync(path.join(ROOT, 'api/services/civicProcessPersistenceService.js'), 'utf8');
  assert.match(src, /getStageRank/);
  assert.match(src, /incomingRank > currentRank/);
  assert.doesNotMatch(src, /canonical_stage = \$5[^\n]*$/m);
});

test('Camera duplicate status rows prefer a terminal state when one is present', () => {
  const rows = camera.normalizeCameraBindings([
    {
      atto: { value: 'http://dati.camera.it/ocd/attocamera.rdf/ac19_1' },
      numero: { value: '1' },
      titolo: { value: 'Iniziativa test' },
      statoLabel: { value: 'Assegnato' },
    },
    {
      atto: { value: 'http://dati.camera.it/ocd/attocamera.rdf/ac19_1' },
      numero: { value: '1' },
      titolo: { value: 'Iniziativa test' },
      statoLabel: { value: 'Approvato definitivamente' },
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stageId, 'closed');
  assert.equal(rows[0].sourceStatus, 'Approvato definitivamente');
});

test('IMP-029 migration remains explicit while canonical source sync is opt-in', () => {
  const app = fs.readFileSync(path.join(ROOT, 'api/app.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'api/server.js'), 'utf8');
  const job = fs.readFileSync(path.join(ROOT, 'api/jobs/civicProcessSyncJob.js'), 'utf8');
  assert.doesNotMatch(app + server, /20261009_civic_processes\.sql/);
  assert.match(app, /ENABLE_CIVIC_PROCESS_SYNC === 'true'/);
  assert.match(app, /civicProcessSyncJob\.start\(\)/);
  assert.match(job, /syncItalianPopularInitiativesSources/);
  assert.match(job, /CIVIC_PROCESS_SYNC_INTERVAL_MS/);
});
