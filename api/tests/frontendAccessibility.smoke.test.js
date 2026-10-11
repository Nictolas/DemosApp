'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('frontend viewport allows browser zoom and has a document title', () => {
  const html = read('client/index.html');
  assert.doesNotMatch(html, /user-scalable\s*=\s*no/i);
  assert.doesNotMatch(html, /maximum-scale\s*=\s*1(?:\.0)?/i);
  assert.match(html, /<title>DEMOS<\/title>/);
});

test('candidate and representative name actions use semantic buttons', () => {
  const files = [
    'client/src/pages/Candidati/components/CandidatoCard.tsx',
    'client/src/pages/Candidati/components/CategoriaPrincipale.tsx',
    'client/src/pages/Rappresentanti/components/CategoriaPrincipale.tsx',
    'client/src/pages/Rappresentanti/components/RappresentanteCard.tsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /<p[^>]*onClick=/s, file);
    assert.match(source, /<button type="button"[^>]*onClick=/s, file);
  }
});

test('critical icon-only controls expose accessible names', () => {
  const phase1 = read('client/src/components/auth/Phase1Email.tsx');
  assert.match(phase1, /aria-label=\{showPassword \?/);
  assert.match(phase1, /aria-label=\{showConfirmPassword \?/);
  assert.match(read('client/src/components/ApprofondimentoButton.tsx'), /aria-label=\{`Apri approfondimento:/);
  assert.match(read('client/src/components/AttivistaModal.tsx'), /aria-label="Chiudi dettagli attivista"/);
  assert.match(read('client/src/components/OrganizzazioneModal.tsx'), /aria-label="Chiudi dettagli organizzazione"/);
});

test('custom detail modals expose dialog semantics', () => {
  for (const file of ['client/src/components/AttivistaModal.tsx', 'client/src/components/OrganizzazioneModal.tsx']) {
    const source = read(file);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-labelledby=/);
  }
});

test('admin menu logo is not a clickable image', () => {
  const source = read('client/src/pages/Menu/components/MenuHeader.tsx');
  assert.match(source, /aria-label="Apri la sezione Gestisci"/);
  assert.doesNotMatch(source, /<img[^>]*onClick=/s);
});
