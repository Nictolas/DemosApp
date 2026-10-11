'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const requirements = fs.readFileSync(path.join(ROOT, 'docs', 'SYSTEM_REQUIREMENTS.md'), 'utf8');

function requirementDefinitionIds() {
  return requirements
    .split('\n')
    .map((line) => line.match(/^\|\s*(RS-\d{3})\s*\|/))
    .filter(Boolean)
    .map((match) => match[1]);
}

test('system requirements cover the four roadmap areas', () => {
  assert.match(requirements, /Architettura e infrastruttura/);
  assert.match(requirements, /Sicurezza, autenticazione e autorizzazione/);
  assert.match(requirements, /Compatibilità web e mobile/);
  assert.match(requirements, /Disponibilità, resilienza e comportamento ai guasti/);
});

test('system requirement identifiers are unique and substantial', () => {
  const ids = requirementDefinitionIds();
  const unique = [...new Set(ids)];
  assert.equal(ids.length, unique.length, 'duplicate RS identifiers found');
  assert.ok(unique.length >= 50, `expected at least 50 system requirements, found ${unique.length}`);
});

test('system requirements distinguish satisfied, partial, open and external constraints', () => {
  for (const state of ['SODDISFATTO', 'PARZIALE', 'DA CHIUDERE', 'ESTERNO']) {
    assert.match(requirements, new RegExp(state));
  }
});

test('critical infrastructure and authentication constraints are explicit', () => {
  assert.match(requirements, /DATABASE_URL/);
  assert.match(requirements, /JWT_SECRET/);
  assert.match(requirements, /almeno 32 caratteri/);
  assert.match(requirements, /Redis/);
  assert.match(requirements, /fallire chiuso/);
  assert.match(requirements, /CIE/);
  assert.match(requirements, /TLS/);
});

test('known pre-release gaps are recorded instead of being presented as completed', () => {
  assert.match(requirements, /versione .*Node\.js.*pin-nata/is);
  assert.match(requirements, /matrice minima di browser\/versioni supportati/i);
  assert.match(requirements, /SLO numerici minimi/i);
  assert.match(requirements, /non deve inventare percentuali o SLA/i);
  assert.match(requirements, /PITR/i);
  assert.match(requirements, /B2/i);
  assert.match(requirements, /VoiceOver/i);
  assert.match(requirements, /TalkBack/i);
});
