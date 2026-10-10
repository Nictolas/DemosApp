const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const route = fs.readFileSync(path.join(ROOT, 'api', 'routes', 'podio-trasparenza.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'api', 'app.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'PodioTrasparenza.tsx'), 'utf8');
const { getPodiumLevels } = require('../services/politicalJurisdictionRegistryService');

test('Transparency Podium is one authenticated API for all five institutional levels', () => {
  assert.match(route, /router\.get\('\/', verifyToken,/);
  assert.match(route, /getPodiumLevels/);
  assert.deepEqual(getPodiumLevels(), ['EUROPEO', 'CAMERA', 'SENATO', 'REGIONE', 'COMUNE']);
  assert.match(app, /app\.use\('\/api\/podio-trasparenza', userLimiter, podioTrasparenzaRoutes\)/);
});

test('Podium uses a rolling 90-day distinct institutional-vote count with no legacy 3/1 scoring', () => {
  assert.match(route, /const WINDOW_DAYS = 90/);
  assert.match(route, /COUNT\(DISTINCT c\.institutional_vote_key\)/);
  assert.match(route, /c\.vote_date >= CURRENT_DATE/);
  assert.match(route, /c\.tipo = 'votazione'/);
  assert.doesNotMatch(route, /punti_trasparenza/);
  assert.doesNotMatch(client, /3 punti|1 punto|punti trasparenza|punti_trasparenza/i);
});

test('regional and municipal podiums are filtered to viewer territory', () => {
  assert.match(route, /regione_residenza/);
  assert.match(route, /comune_residenza/);
  assert.match(route, /jurisdiction->>'region'/);
  assert.match(route, /jurisdiction->>'municipality'/);
  assert.match(route, /u\.regione_elezione/);
  assert.match(route, /u\.comune_elezione/);
});

test('Podium keeps only active politicians at the matching mandate level', () => {
  assert.match(route, /political_mandates pm/);
  assert.match(route, /pm\.status = 'ACTIVE'/);
  assert.match(route, /pm\.starts_at <= NOW\(\)/);
  assert.match(route, /pm\.ends_at IS NULL OR pm\.ends_at > NOW\(\)/);
  assert.match(route, /u\.ruolo IN \('P', 'CP', 'Politico', 'Candidato Politico'\)/);
});

test('Podium caps payload and ranks deterministically per level', () => {
  assert.match(route, /const MAX_PER_LEVEL = 50/);
  assert.match(route, /ROW_NUMBER\(\) OVER/);
  assert.match(route, /PARTITION BY institutional_level/);
  assert.match(route, /ORDER BY numero_voti DESC, ultimo_voto DESC/);
});

test('Podium direct representative choice reuses the canonical selection endpoint', () => {
  assert.match(client, /\/api\/users\/\$\{user\.id\}\/seleziona-rappresentante/);
  for (const field of [
    'rappresentante_europeo',
    'rappresentante_camera',
    'rappresentante_senato',
    'rappresentante_regionale',
    'rappresentante_comune'
  ]) {
    assert.match(client, new RegExp(field));
  }
  assert.match(client, /Scegli come rappresentante/);
});

test('Podium UI states the canonical metric and only the 90-day window', () => {
  assert.match(client, /ultimi 90 giorni/);
  assert.match(client, /soltanto voti e decisioni istituzionali/);
  assert.doesNotMatch(client, /ultimi 30 giorni/);
  assert.doesNotMatch(client, /comizi.*contano/i);
});


test('Podium selection is a true alternative to matching while preserving eligibility checks', () => {
  const profile = fs.readFileSync(path.join(ROOT, 'api', 'routes', 'users', 'profile.js'), 'utf8');
  assert.match(client, /source:\s*\"podio\"/);
  assert.match(profile, /const isPodiumDirectChoice = source === 'podio' && campo\.startsWith\('rappresentante_'\)/);
  assert.match(profile, /if \(!isPodiumDirectChoice\) \{/);
  assert.match(profile, /isRepresentativeSelectionEligible/);
  assert.match(profile, /RAPPRESENTANTE_NON_SELEZIONABILE/);
});
