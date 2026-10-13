const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeMinisteroPopularInitiativeRow,
} = require('../services/civicSources/italyMinisteroPopularInitiativesAdapter');
const camera = require('../services/civicSources/italyCameraPopularInitiativesAdapter');
const senato = require('../services/civicSources/italySenatoPopularInitiativesAdapter');
const {
  syncItalianPopularInitiativesSources,
} = require('../services/italianPopularInitiativesParliamentSyncService');

test('Ministero row normalizes as signature-source record, not parliamentary evidence', () => {
  const record = normalizeMinisteroPopularInitiativeRow({
    id_ministero: 123,
    titolo: 'Iniziativa popolare di prova',
    tipo: 'Legge di iniziativa popolare',
    stato: 'in_corso',
    firme_raccolte: 42000,
    quorum_raggiunto: false,
    sito_web: 'https://example.test/firma',
    data_inizio: '2026-09-01',
    updated_at: '2026-10-09T10:00:00Z',
  });

  assert.equal(record.sourceId, 'it.justice.signature_portal');
  assert.equal(record.stageId, 'signature_collection');
  assert.deepEqual(record.officialIdentifiers, [
    { namespace: 'it.justice.signature_portal', value: '123' },
  ]);
  assert.equal(record.metadata.signatureThreshold, 50000);
  assert.equal(record.metadata.quorumReached, false);
});

test('Ministero adapter rejects non-popular-initiative rows', () => {
  const record = normalizeMinisteroPopularInitiativeRow({
    id_ministero: 456,
    titolo: 'Referendum test',
    tipo: 'Referendum abrogativo',
    stato: 'in_corso',
  });
  assert.equal(record, null);
});

test('Camera and Senato live-shape records share a phase identifier for the same Camera bill', () => {
  const cameraRecord = camera.normalizeCameraBinding({
    atto: { value: 'http://dati.camera.it/ocd/attocamera.rdf/ac19_2841' },
    numero: { value: '2841' },
    titolo: { value: 'PROPOSTA DI LEGGE D’INIZIATIVA POPOLARE: Titolo Camera (2841)' },
    statoLabel: { value: 'Assegnato' },
  });
  const senatoRecord = senato.normalizeSenatoBinding({
    ddl: { value: 'http://dati.senato.it/ddl/59984' },
    idDdl: { value: '55242' },
    ramo: { value: 'C' },
    numeroFase: { value: '2841' },
    titolo: { value: 'Titolo Senato dataset' },
    stato: { value: 'esame in comm.' },
    tipoIniziativa: { value: 'Popolare' },
  });

  const cameraPhase = cameraRecord.officialIdentifiers.find(x => x.namespace === 'it.parliament.phase');
  const senatePhase = senatoRecord.officialIdentifiers.find(x => x.namespace === 'it.parliament.phase');
  assert.deepEqual(cameraPhase, { namespace: 'it.parliament.phase', value: '19:C:2841' });
  assert.deepEqual(senatePhase, cameraPhase);
  assert.ok(senatoRecord.officialIdentifiers.some(x => x.namespace === 'it.parliament.iter' && x.value === '19:55242'));
});

test('multi-source orchestrator keeps source failures isolated and never fabricates fallback records', async () => {
  const inserted = [];
  let sequence = 0;
  const client = {
    async query(sql) {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (/FROM civic_process_source_records csr/.test(sql)) return { rows: [] };
      if (/FROM civic_process_identifiers/.test(sql)) return { rows: [] };
      if (/FROM civic_processes/.test(sql) && /official_reference/.test(sql)) return { rows: [] };
      if (/INSERT INTO civic_processes/.test(sql)) return { rows: [{ id: `p${++sequence}` }] };
      if (/INSERT INTO civic_process_identifiers/.test(sql)) return { rows: [] };
      if (/INSERT INTO civic_process_source_records/.test(sql)) {
        inserted.push(sql);
        return { rows: [{ id: `s${sequence}`, civic_process_id: `p${sequence}` }] };
      }
      if (/UPDATE civic_processes/.test(sql)) return { rows: [] };
      if (/SELECT id\s+FROM civic_processes/.test(sql)) return { rows: [] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => client,
  };

  const result = await syncItalianPopularInitiativesSources({
    pool,
    loadMinistero: async () => [{
      jurisdictionId: 'it', processTypeId: 'it.popular_law_initiative', sourceId: 'it.justice.signature_portal',
      externalId: 'm1', title: 'Ministero 1', stageId: 'signature_collection', officialIdentifiers: [],
    }],
    fetchCamera: async () => { throw new Error('CAMERA_DOWN'); },
    fetchSenato: async () => [{
      jurisdictionId: 'it', processTypeId: 'it.popular_law_initiative', sourceId: 'it.parliament.senate',
      externalId: 's1', title: 'Senato 1', stageId: 'parliamentary_review', officialIdentifiers: [],
    }],
  });

  assert.equal(result.sources.ministero.fetched, 1);
  assert.equal(result.sources.ministero.ingested, 1);
  assert.equal(result.sources.camera.fetched, 0);
  assert.equal(result.sources.camera.errors[0].code, 'CAMERA_DOWN');
  assert.equal(result.sources.senato.fetched, 1);
  assert.equal(result.sources.senato.ingested, 1);
  assert.equal(inserted.length, 2);
});
