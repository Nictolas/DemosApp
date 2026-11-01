const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const model = fs.readFileSync(path.join(root, "client/src/lib/politicalCompassModel.ts"), "utf8");
const component = fs.readFileSync(
  path.join(root, "client/src/pages/Profilo/components/PoliticalCompassPreview.tsx"), "utf8");
const profile = fs.readFileSync(path.join(root, "client/src/pages/Profilo/index.tsx"), "utf8");

const catalog = Array.from({ length: 6 }, (_, index) =>
  JSON.parse(fs.readFileSync(
    path.join(root, "api/catalog/opinions-part-0" + index + ".json"), "utf8"))
).flat();

const rules = Array.from(model.matchAll(
  /\{\s*id:\s*"([^"]+)",\s*label:\s*"[^"]+",\s*axis:\s*"(economia|liberta)",\s*direction:\s*(-?1)\s*\}/g
), ([, id, axis, sign]) => ({ id, axis, sign: Number(sign) }));

test("il prototipo utilizza soltanto ID presenti nel catalogo ufficiale", () => {
  assert.equal(catalog.length, 94);
  const knownIds = new Set(catalog.map((entry) => entry.id));
  assert.ok(rules.length >= 20, "numero insufficiente di regole esplicite");
  assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
  for (const rule of rules) {
    assert.ok(knownIds.has(rule.id), "ID non presente nel catalogo: " + rule.id);
  }
});

test("ogni asse contiene proposte in entrambe le direzioni", () => {
  for (const axis of ["economia", "liberta"]) {
    const items = rules.filter((rule) => rule.axis === axis);
    assert.ok(items.length >= 10);
    assert.ok(items.some((item) => item.sign === 1));
    assert.ok(items.some((item) => item.sign === -1));
  }
});

test("nessun voto o dato politico viene scritto o richiesto dalla nuova UI", () => {
  assert.match(component, /calculatePoliticalCompass\(answers\)/);
  assert.match(component, /setVisible/);
  assert.doesNotMatch(component, /fetch\s*\(|apiRequest\s*\(|localStorage|sessionStorage|indexedDB|postMessage/);
  assert.match(profile, /!consentGranted/);
  assert.match(profile, /<PoliticalCompassPreview answers=\{userOpinions\}/);
});

test("indecisione e scarsita di risposte impediscono una coordinata artificiale", () => {
  assert.match(model, /if \(answer === 0\) \{/);
  assert.match(model, /answered >= 5 && negative\.length > 0 && positive\.length > 0/);
  assert.match(model, /score = qualified\s*\?/);
  assert.match(component, /compass\.economy\.score !== null/);
  assert.match(component, /compass\.freedom\.score !== null/);
});
