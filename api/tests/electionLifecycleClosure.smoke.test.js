const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const route = read('api/routes/eventi.js');
const service = read('api/services/electionLifecycleService.js');
const lifecycle = read('api/services/politicalLifecycleService.js');
const program = read('api/services/candidacyProgramService.js');
const migration = read('20261009_election_lifecycle.sql');
const eventUi = read('client/src/pages/Eventi.tsx');
const { getLegacySelectionFields } = require('../services/politicalJurisdictionRegistryService');

test('election closure is an authenticated Admin-only explicit action', () => {
  assert.match(route, /router\.post\('\/:id\/close-election', verifyToken, requireAdmin,/);
  const start = route.indexOf("router.post('/:id/close-election'");
  const end = route.indexOf('// GET /api/eventi/:id', start);
  const block = route.slice(start, end);
  assert.doesNotMatch(block, /req\.body/);
  assert.match(block, /closeElectionLifecycle\(client/);
  assert.match(block, /await client\.query\('BEGIN'\)/);
  assert.match(block, /await client\.query\('COMMIT'\)/);
  assert.match(block, /await client\.query\('ROLLBACK'\)/);
});

test('winner status comes from an active mandate linked to the same election event', () => {
  assert.match(service, /FROM political_mandates/);
  assert.match(service, /WHERE election_event_id = \$1 AND status = 'ACTIVE'/);
  assert.match(service, /endCandidacy\(client, candidacy\.id, 'ELECTED'/);
  assert.match(service, /endCandidacy\(client, candidacy\.id, 'NOT_ELECTED'/);
  assert.doesNotMatch(service, /winner|vincitore|elected_user_ids/i);
});

test('closing a candidacy reuses the canonical Program finalization path', () => {
  assert.match(lifecycle, /finalizeCandidacyProgram/);
  assert.match(program, /INSERT INTO mandate_program_snapshots/);
  assert.match(program, /DELETE FROM political_programs WHERE candidacy_id = \$1/);
});

test('current candidate support is cleared at election closure through the jurisdiction registry', () => {
  assert.deepEqual(getLegacySelectionFields('candidate'), [
    'candidato_europeo',
    'candidato_camera',
    'candidato_senato',
    'candidato_regionale',
    'candidato_comune'
  ]);
  assert.match(service, /getLegacySelectionField/);
  assert.match(service, /getLegacySelectionFieldsForElectionType/);
  assert.match(service, /SET \$\{field\} = NULL/);
});

test('election lifecycle closure is date-gated and idempotent', () => {
  assert.match(service, /COALESCE\(giorno_fine, giorno_inizio\) <= CURRENT_DATE/);
  assert.match(service, /ELECTION_NOT_ENDED/);
  assert.match(service, /event\.election_lifecycle_closed_at/);
  assert.match(service, /alreadyClosed: true/);
});

test('migration records only closure timestamp and responsible Admin on the event', () => {
  assert.match(migration, /election_lifecycle_closed_at TIMESTAMPTZ/);
  assert.match(migration, /election_lifecycle_closed_by_user_id UUID/);
  assert.match(migration, /REFERENCES users\(id\)/);
  assert.match(migration, /idx_eventi_election_lifecycle_open/);
});

test('Admin global Events UI exposes closure only for ended elections and shows closed state', () => {
  assert.match(eventUi, /activeTab === 'global'/);
  assert.match(eventUi, /electionHasEnded\(evento\)/);
  assert.match(eventUi, /`\/api\/eventi\/\$\{eventId\}\/close-election`/);
  assert.match(eventUi, /Chiudi elezione/);
  assert.match(eventUi, /Lifecycle chiuso/);
  assert.match(eventUi, /evento\.election_lifecycle_closed_at/);
});
