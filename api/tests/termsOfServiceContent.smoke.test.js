const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const terms = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'TermsOfService.tsx'),
  'utf8'
);

test('Terms of Service show a fixed revision, not the current visit date', () => {
  assert.match(terms, /const TERMS_VERSION = '\d{2}\/\d{2}\/\d{4}'/);
  assert.doesNotMatch(terms, /new Date\(\)\.toLocaleDateString/);
});

test('Terms of Service describe editable opinions and account-linked choices accurately', () => {
  assert.match(terms, /opinioni modificabili possono essere aggiornate/i);
  assert.match(terms, /collegate tecnicamente all'account/);
  assert.match(terms, /consensi necessari[\s\S]{0,140}richiesti separatamente/);
  assert.doesNotMatch(terms, /voti sono anonimi e non tracciabili/i);
  assert.doesNotMatch(terms, /Non è possibile modificare il voto dopo l'invio/i);
});

test('Terms of Service do not assert a fictitious institution or restrict consumer jurisdiction', () => {
  assert.doesNotMatch(terms, /Istituto Demos/);
  assert.doesNotMatch(terms, /Foro di Roma/);
  assert.match(terms, /foro del consumatore/);
  assert.doesNotMatch(terms, /licenza non esclusiva, gratuita e perpetua/);
});

test('Terms of Service do not make unsupported claims of universal Italian eligibility or permanent anonymity', () => {
  assert.doesNotMatch(terms, /Essere cittadino italiano o residente in Italia/);
  assert.doesNotMatch(terms, /impossibile risalire all.identità dei singoli utenti/);
  assert.match(terms, /rischio di identificazione/);
});
