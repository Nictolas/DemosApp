const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const { buildQueryForTipo, mapToLegacyFormat } = require('../utils/iniziativeMinisteroMapper');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('legacy initiative query binds matcher and threshold from the registry', () => {
  const { query, params } = buildQueryForTipo('iniziativa', null, null, true, false);
  assert.deepEqual(params, ['%Legge%di%iniziativa%popolare%', 50000]);
  assert.match(query, /tipo LIKE \$1/);
  assert.match(query, /firme_raccolte >= \$2/);
});

test('legacy referendum query binds both source matchers plus its registry threshold', () => {
  const { query, params } = buildQueryForTipo('referendum', null, null, true, false);
  assert.deepEqual(params, ['%Referendum%abrogativo%', '%Referendum%costituzionale%', 500000]);
  assert.match(query, /tipo LIKE \$1 OR tipo LIKE \$2/);
  assert.match(query, /firme_raccolte >= \$3/);
});

test('legacy Ministero mapping exposes canonical metadata without removing compatibility fields', () => {
  const mapped = mapToLegacyFormat({
    id: 'ministero_1',
    id_ministero: '1',
    titolo: 'Una iniziativa di prova',
    descrizione: 'Descrizione',
    tipo: 'Legge di iniziativa popolare',
    stato: 'in_corso',
    firme_raccolte: 123,
    quorum_raggiunto: false,
    sito_web: 'https://example.test',
    created_at: '2026-10-09T00:00:00Z',
  }, 'iniziativa');

  assert.equal(mapped.nome, 'Una iniziativa di prova');
  assert.equal(mapped.id_ministero, '1');
  assert.equal(mapped.jurisdiction_id, 'it');
  assert.equal(mapped.civic_process_type_id, 'it.popular_law_initiative');
  assert.equal(mapped.civic_process_stage, 'signature_collection');
  assert.equal(mapped.civic_process_source_id, 'it.justice.signature_portal');
  assert.equal(mapped.signature_threshold, 50000);
  assert.equal(mapped.demos_actions.external_signature, true);
  assert.equal(mapped.demos_actions.demos_priority, false);
});

test('initiative priority is canonical, signature-qualified and fail-closed before canonical schema readiness', () => {
  const route = read('api/routes/iniziative-popolari.js');
  assert.match(route, /req\.query\.vota === 'true'[\s\S]*getPrioritySourceStatus/);
  assert.match(route, /CIVIC_PROCESS_MIGRATION_REQUIRED/);
  assert.doesNotMatch(route, /PARLIAMENTARY_SOURCE_REQUIRED/);
  assert.match(route, /signature_collection_closed_and_threshold_reached/);
  assert.match(route, /listPriorityEligiblePopularInitiatives/);

  const postStart = route.indexOf("router.post('/vota'");
  const deleteStart = route.indexOf("router.delete('/vota'", postStart);
  assert.notEqual(postStart, -1);
  assert.notEqual(deleteStart, -1);
  const post = route.slice(postStart, deleteStart);
  assert.match(post, /getPriorityEligiblePopularInitiative/);
  assert.match(post, /INIZIATIVA_NON_ELEGGIBILE/);
  assert.match(post, /assertPreferenceChangeAllowed/);
  assert.match(post, /INSERT INTO voti_iniziative_popolari/);
  assert.match(post, /recordPreferenceChange/);
  assert.doesNotMatch(post, /PARLIAMENTARY_SOURCE_REQUIRED/);
});

test('legacy initiative preference DELETE remains available only to clean an existing preference', () => {
  const route = read('api/routes/iniziative-popolari.js');
  assert.match(route, /DELETE \/api\/iniziative-popolari\/vota - consente di rimuovere una preferenza legacy già esistente/);
  assert.match(route, /router\.delete\('\/vota', verifyToken/);
});

test('initiative priority client explains concluded signature collection rather than parliamentary entry', () => {
  const page = read('client/src/pages/VotaIniziativaPopolare/index.tsx');
  const header = read('client/src/pages/VotaIniziativaPopolare/components/Header.tsx');
  const types = read('client/src/pages/VotaIniziativaPopolare/types/index.ts');
  const voting = read('client/src/pages/VotaIniziativaPopolare/hooks/useIniziativeVoting.ts');

  assert.match(types, /civic_process_policy\?:/);
  assert.match(types, /eligibility\?: string/);
  assert.match(page, /civic_process_policy\?\.enabled === false/);
  assert.doesNotMatch(page, /fonte parlamentare ufficiale/);
  assert.match(page, /raccolta firme è conclusa/);
  assert.match(header, /conclusione della raccolta firme/);
  assert.doesNotMatch(header, /entrate ufficialmente nell’iter parlamentare/);
  assert.doesNotMatch(voting, /una settimana/);
  assert.match(voting, /dopo 24 ore/);
  assert.match(voting, /apiRequest\("DELETE", "\/api\/iniziative-popolari\/vota"\)/);
  assert.match(voting, /deleteVotoMutation\.mutate/);
});
