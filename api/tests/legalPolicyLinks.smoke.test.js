const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const app = read('client/src/App.tsx');
const registration = read('client/src/pages/registrazione-consensi.tsx');
const settingsLinks = read('client/src/pages/Impostazioni/components/LinksSection.tsx');
const legalInfo = read('client/src/pages/Impostazioni/InformazioniLegali/index.tsx');

test('public legal routes expose Privacy Policy and Terms of Service', () => {
  assert.match(app, /<Route path="\/privacy-policy">/);
  assert.match(app, /<Route path="\/terms-of-service">/);
});

test('registration provides explicit links to Privacy Policy and Terms of Service', () => {
  assert.match(registration, /navigate\("\/privacy-policy\?from=\/registrazione-consensi-privacy"\)/);
  assert.match(registration, /navigate\("\/terms-of-service\?from=\/registrazione-consensi-termini"\)/);
  assert.match(registration, /Leggi la Privacy Policy/);
  assert.match(registration, /Leggi i Termini di Servizio/);
});

test('settings provides a reachable legal-information entry point', () => {
  assert.match(settingsLinks, /<Link href="\/impostazioni\/informazioni-legali">/);
});

test('legal-information settings exposes direct Privacy Policy and Terms links', () => {
  assert.match(legalInfo, /<Link href="\/privacy-policy">/);
  assert.match(legalInfo, /<Link href="\/terms-of-service">/);
  assert.match(legalInfo, />Privacy Policy<\/div>/);
  assert.match(legalInfo, />Termini di servizio<\/div>/);
});
