const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('DAIT electoral-unit sync is strictly opt-in and event-scoped', () => {
  const app = read('api/app.js');
  const job = read('api/jobs/italianElectionUnitSyncJob.js');
  assert.match(app, /ENABLE_ITALIAN_ELECTION_UNIT_SYNC === 'true'/);
  assert.match(app, /italianElectionUnitSyncJob\.start\(\)/);
  assert.match(job, /ITALIAN_ELECTION_UNIT_SYNC_EVENT_ID/);
  assert.match(job, /ELECTION_UNIT_SYNC_EVENT_REQUIRED/);
});

test('ingestion joins DAIT unit identity with the separate Gazzetta perimeter evidence', () => {
  const service = read('api/services/italianElectionUnitIngestionService.js');
  assert.match(service, /mappingComplete/);
  assert.match(service, /mappingAuthorityRequired/);
  assert.match(service, /perimeterUnit\?\.territories/);
  assert.match(service, /jsonb_to_recordset/);
  assert.match(service, /perimeterLegalBasis/);
  assert.match(service, /ELECTION_SOURCE_EVENT_DATE_MISMATCH/);
  assert.match(service, /ON CONFLICT \(evento_id, code\)/);
});

test('official snapshots contain no candidate personal data and legal perimeter is complete', () => {
  const snapshot = read('api/data/official/it/dait-politiche-20220925-units.json');
  const perimeter = read('api/data/official/it/gazzetta-dlgs177-2020-perimeters.json');
  assert.doesNotMatch(snapshot.toUpperCase(), /"CANDIDATO"|"DATA_NASCITA"|"LUOGO_NASCITA"/);
  assert.doesNotMatch(perimeter.toUpperCase(), /"CANDIDATO"|"DATA_NASCITA"|"LUOGO_NASCITA"|"DESCR_LISTA"/);
  assert.match(snapshot, /"mappingComplete":false/);
  assert.match(perimeter, /"mappingComplete":true/);
  assert.match(perimeter, /SUB_MUNICIPAL_AREA/);
});

test('public election routes do not expose a source-import mutation endpoint', () => {
  const elections = read('api/routes/elezioni.js');
  const events = read('api/routes/eventi.js');
  assert.doesNotMatch(elections, /italianElectionUnitIngestionService/);
  assert.doesNotMatch(events, /italianElectionUnitIngestionService/);
});
