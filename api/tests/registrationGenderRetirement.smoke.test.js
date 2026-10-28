'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('la registrazione salta il passaggio genere e conserva il vecchio URL come redirect', () => {
  const app = read('client/src/App.tsx');
  assert.doesNotMatch(app, /import RegistrazioneGenere from/);
  assert.match(app, /<Route path="\/registrazione-genere">\s*<Redirect to="\/registrazione-cittadinanza" \/>/);
  assert.equal(fs.existsSync(path.join(ROOT, 'client/src/pages/registrazione-genere.tsx')), false);

  const name = read('client/src/pages/registrazione-nome.tsx');
  assert.match(name, /navigate\("\/registrazione-cittadinanza"\)/);
  assert.doesNotMatch(name, /navigate\("\/registrazione-genere"\)/);

  const opinions = read('client/src/pages/registrazione-consensi-opinioni.tsx');
  assert.match(opinions, /navigate\("\/registrazione-cittadinanza"\)/);
  assert.doesNotMatch(opinions, /navigate\("\/registrazione-genere"\)/);
});

test('il back dalla cittadinanza non torna al passaggio inutile e rispetta passkey', () => {
  const app = read('client/src/App.tsx');
  const hook = read('client/src/hooks/useBrowserNavigation.ts');
  const citizenship = read('client/src/pages/registrazione-cittadinanza.tsx');

  for (const source of [app, hook]) {
    assert.match(source, /'\/registrazione-cittadinanza': '\/registrazione-nome'/);
    assert.doesNotMatch(source, /'\/registrazione-cittadinanza': '\/registrazione-genere'/);
    assert.match(source, /registrazione_passkey_flow/);
    assert.match(source, /registrazione-consensi\?step=3/);
    assert.match(source, /webauthn_user_id/);
  }
  assert.match(citizenship, /registrazione_passkey_flow/);
  assert.match(citizenship, /"\/registrazione-consensi\?step=3"/);
  assert.match(citizenship, /webauthn_user_id/);
  assert.match(citizenship, /"\/registrazione-nome"/);
  assert.doesNotMatch(citizenship, /navigate\("\/registrazione-genere"\)/);
});

test('il flusso di registrazione ordinario non inventa sesso CIE nel localStorage', () => {
  for (const f of [
    'client/src/pages/registrazione-nome.tsx',
    'client/src/pages/registrazione-cittadinanza.tsx',
    'client/src/pages/registrazione-consensi-opinioni.tsx'
  ]) {
    const source = read(f);
    assert.doesNotMatch(source, /registrazione_genere|registrazione_sesso|setItem\("sesso"/);
  }
});
