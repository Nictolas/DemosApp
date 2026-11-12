const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const read = filename => readFileSync(resolve(__dirname, '../..', filename), 'utf8');

test('owner proposed and voted opinions are separate in one protected profile query', () => {
  const api = read('api/routes/user/profile-selections.js');
  assert.match(api, /router\.get\('\/', verifyToken, requirePoliticalConsent/);
  assert.match(api, /FROM users u/);
  assert.match(api, /WHERE u\.id = \$1/);
  assert.match(api, /FROM opinioni_proposte p/);
  assert.match(api, /p\.id::text = u\.opinione_proposta_id::text/);
  assert.match(api, /NULLIF\(BTRIM\(p\.text\), ''\)/);
  assert.match(api, /opinioneProposta: selection\.opinione_proposta \|\| null/);
  assert.match(api, /opinioniProposteVotate: selection\.opinioni_proposte_votate \|\| \[\]/);
  assert.match(api, /FROM voti_opinioni_proposte v/);
  assert.match(api, /JOIN opinioni_proposte p ON p\.id::text = v\.opinione_id::text/);
  assert.match(api, /WHERE v\.utente_id = u\.id/);
  assert.match(api, /'Cache-Control', 'private, no-store, max-age=0'/);
  assert.doesNotMatch(api, /SELECT \* FROM opinioni_proposte/);
});

test('profile lists own proposed opinion with working navigation and appropriate empty state', () => {
  const chosen = read('client/src/pages/Profilo/components/ProfileChosenPreferences.tsx');
  assert.match(chosen, /key: "opinioneProposta"/);
  assert.match(chosen, /label: "Opinione proposta"/);
  assert.match(chosen, /choices\?\.opinioniProposteVotate/);
  assert.match(chosen, /label: "La tua Opinione proposta"/);
  assert.match(chosen, /choices\?\.opinioneProposta/);
  assert.match(chosen, /path: "\/proponi-opinione"/);
  assert.match(chosen, /Nessun voto selezionato/);
  assert.match(chosen, /Vota ora/);
  assert.doesNotMatch(chosen, /fetch\(|apiRequest\(|useQuery\(/);
});

test('old per-user encrypted snapshots refresh once without adding a new profile call', () => {
  const vault = read('client/src/pages/Profilo/utils/encryptedProfileVault.ts');
  const hook = read('client/src/pages/Profilo/hooks/useProfileData.ts');
  const route = read('api/routes/user/profile-selections.js');
  assert.match(vault, /version\?: 4;/);
  assert.match(vault, /opinioneProposta\?: string \| null/);
  assert.match(vault, /opinioniProposteVotate\?: string\[\]/);
  assert.match(hook, /snapshot\.preferences\?\.version !== 4/);
  assert.match(route, /version: 4/);
  assert.match(hook, /getPayload\("\/api\/user\/profile-selections"\)/);
  assert.match(hook, /enabled: enabled && vaultReady && politicalAllowed/);
});
