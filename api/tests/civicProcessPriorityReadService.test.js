const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const {
  mapCanonicalPriorityRow,
  isMissingCivicSchemaError,
} = require('../services/civicProcessReadService');

test('canonical priority projection keeps civic-process identity and compatibility fields', () => {
  const mapped = mapCanonicalPriorityRow({
    id: '00000000-0000-4000-8000-000000000001',
    canonical_title: 'Iniziativa ufficiale',
    canonical_stage: 'parliamentary_review',
    site_url: 'https://camera.example/1',
    first_official_date: '2026-10-01',
    signatures: 123,
    votes: 4,
    official_sources: [{ sourceId: 'it.parliament.camera' }],
  });
  assert.equal(mapped.id, '00000000-0000-4000-8000-000000000001');
  assert.equal(mapped.civic_process_stage, 'parliamentary_review');
  assert.equal(mapped.signature_threshold, 50000);
  assert.equal(mapped.voti, 4);
  assert.equal(mapped.official_sources.length, 1);
});

test('missing canonical schema is recognized only as an undefined civic relation', () => {
  assert.equal(isMissingCivicSchemaError({ code: '42P01', message: 'relation "civic_processes" does not exist' }), true);
  assert.equal(isMissingCivicSchemaError({ code: '42P01', message: 'relation "users" does not exist' }), false);
  assert.equal(isMissingCivicSchemaError({ code: '23505', message: 'duplicate civic_processes' }), false);
});

test('priority query requires concluded official signature collection and threshold evidence, not parliamentary stage', () => {
  const src = read('api/services/civicProcessReadService.js');
  assert.match(src, /signature_source\.source_id = \$4|signature_source\.source_id = \$3/);
  assert.match(src, /signature_source\.source_stage = ANY/);
  assert.match(src, /payload_metadata->>'signatures'/);
  assert.match(src, /payload_metadata->>'quorumReached'/);
  assert.match(src, />= \$6/);
  assert.match(src, /LEFT JOIN voti_iniziative_popolari vip ON vip\.iniziativa_id = cp\.id::text/);
  assert.doesNotMatch(src, /cp\.canonical_stage =/);
  assert.doesNotMatch(src, /parliamentary\.source_stage/);
});

test('priority source readiness is scoped to the official Italian signature source', () => {
  const src = read('api/services/civicProcessReadService.js');
  assert.match(src, /csr\.source_id = \$1/);
  assert.match(src, /cp\.jurisdiction_id = \$2/);
  assert.match(src, /cp\.process_type_id = \$3/);
});

test('explicit reconciliation merges the entire canonical source process including identifiers', () => {
  const src = read('api/services/civicProcessPersistenceService.js');
  assert.match(src, /UPDATE civic_process_identifiers[\s\S]*WHERE civic_process_id = \$1/);
  assert.match(src, /UPDATE civic_process_source_records[\s\S]*WHERE civic_process_id = \$1/);
  assert.match(src, /DELETE FROM civic_processes WHERE id = \$1/);
  assert.match(src, /RECONCILIATION_PROCESS_MISMATCH/);
});
