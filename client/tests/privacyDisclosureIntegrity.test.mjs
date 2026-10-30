import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const load = name => readFileSync(new URL("../src/pages/" + name, import.meta.url), "utf8");
const privacy = load("PrivacyPolicy.tsx");
const register = load("RegistroTrattamenti.tsx");

test("policy and treatment register never pass today's date off as revision date", () => {
  for (const document of [privacy, register]) {
    assert.doesNotMatch(document, /Ultima modifica[^\n]*new Date\(/);
    assert.match(document, /Ultima modifica del testo: 30\/10\/2026/);
  }
});
test("accounting record retention is not asserted as a legal basis for keeping political votes or ordinary profiles", () => {
  assert.doesNotMatch(privacy, /Conservazione per finalit[aà] di democrazia partecipativa e\s+trasparenza politica \(Art\. 2220/);
  assert.doesNotMatch(register, /(?:7 anni dalla data di registrazione|5 anni dalla data di espressione)[^\n]*Art\. 2220/);
  assert.match(privacy, /scritture contabili/);
  assert.match(register, /scritture contabili/);
});
test("consent revocation describes both active erasure and offline local copy limits", () => {
  assert.match(privacy, /rilevata dall'app/);
  assert.match(privacy, /successiva verifica della sessione/);
  assert.match(privacy, /copie di sicurezza richiedono procedure distinte/);
  assert.doesNotMatch(privacy, /eliminate completamente<\/strong> dal sistema/);
});
test("policy does not promise unverified automatic deletion of every table", () => {
  assert.doesNotMatch(privacy, /La cancellazione dei dati avviene <strong>automaticamente<\/strong>/);
  assert.doesNotMatch(privacy, /I dati vengono cancellati automaticamente alla scadenza/);
  assert.match(privacy, /effettivi meccanismi di cancellazione applicabili/);
});
