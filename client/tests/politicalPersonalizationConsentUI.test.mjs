import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => readFileSync(path.join(root, rel), 'utf8');

test('political consent in registration is explicit, opt-out does not block registration', () => {
  const wizard = read('client/src/pages/registrazione-consensi.tsx');
  const standalone = read('client/src/pages/registrazione-consensi-opinioni.tsx');
  assert.match(wizard, /const handleSkipPoliticalConsent = \(\) => \{/);
  assert.match(wizard, /localStorage\.setItem\("registrazione_political_opinions_consent", "false"\)/);
  assert.match(wizard, /onClick=\{handleSkipPoliticalConsent\}/);
  assert.match(wizard, /setStep\(4\)/);
  assert.match(standalone, /const continueRegistration = \(politicalConsent: boolean\)/);
  assert.match(standalone, /continueRegistration\(false\)/);
  assert.match(standalone, /continueRegistration\(true\)/);
  assert.match(standalone, /navigate\("\/registrazione-genere"\)/);
  for (const source of [wizard, standalone]) {
    assert.match(source, /Continua senza consenso politico/);
    assert.match(source, /Maggiori informazioni/);
  }
});

test('GDPR withdrawal explains loss of political personalization, not all features', () => {
  const gdpr = read('client/src/pages/GDPR/index.tsx');
  const modal = read('client/src/components/PoliticalOpinionsConsentModal.tsx');
  assert.match(gdpr, /confronti personalizzati/);
  assert.match(gdpr, /informazioni pubbliche/);
  assert.match(gdpr, /cancellare il tuo account/);
  assert.match(modal, /confronti personalizzati/);
  assert.match(modal, /Rifiuta/);
  assert.doesNotMatch(gdpr, /continuare a utilizzare tutte le altre funzionalità/);
  assert.doesNotMatch(modal, /utilizzare tutte le altre funzionalità/);
  assert.doesNotMatch(gdpr + modal, /eliminate completamente|eliminate\s+completamente/);
});

test('frontend keeps optional re-consent mechanism and consent cache invalidation', () => {
  const modal = read('client/src/components/PoliticalOpinionsConsentModal.tsx');
  const gdpr = read('client/src/pages/GDPR/index.tsx');
  assert.match(modal, /\/api\/user\/political-opinions-consent/);
  assert.match(modal, /queryClient\.invalidateQueries\(\{ queryKey: \['political-opinions-consent'\]/);
  assert.match(gdpr, /\/api\/user\/political-opinions-consent\/revoke/);
  assert.match(gdpr, /queryClient\.removeQueries\(\{ queryKey: \['opinioniQuestions'\]/);
});
