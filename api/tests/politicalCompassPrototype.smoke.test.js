const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const modelSource = fs.readFileSync(path.join(root, "client/src/lib/politicalCompassModel.ts"), "utf8");
const component = fs.readFileSync(
  path.join(root, "client/src/pages/Profilo/components/PoliticalCompassPreview.tsx"), "utf8");
const profile = fs.readFileSync(path.join(root, "client/src/pages/Profilo/index.tsx"), "utf8");
const compassPage = fs.readFileSync(path.join(root, "client/src/pages/CompassoPolitico.tsx"), "utf8");
const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");

const catalog = Array.from({ length: 6 }, (_, index) =>
  JSON.parse(fs.readFileSync(
    path.join(root, "api/catalog/opinions-part-0" + index + ".json"), "utf8"))
).flat();

const rules = Array.from(modelSource.matchAll(
  /\{\s*id:\s*"([^"]+)",\s*label:\s*"[^"]+",\s*axis:\s*"(economia|liberta)",\s*direction:\s*(-?1)\s*\}/g
), ([, id, axis, sign]) => ({ id, axis, sign: Number(sign) }));

test("il prototipo utilizza soltanto ID presenti nel catalogo ufficiale", () => {
  assert.equal(catalog.length, 94);
  const knownIds = new Set(catalog.map((entry) => entry.id));
  assert.equal(rules.length, 28, "la revisione del catalogo richiede un aggiornamento esplicito dei test");
  assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
  for (const rule of rules) {
    assert.ok(knownIds.has(rule.id), "ID non presente nel catalogo: " + rule.id);
  }
});

test("ogni asse contiene proposte in entrambe le direzioni", () => {
  for (const axis of ["economia", "liberta"]) {
    const items = rules.filter((rule) => rule.axis === axis);
    assert.ok(items.length >= 10);
    assert.ok(items.filter((item) => item.sign === 1).length >= 2);
    assert.ok(items.filter((item) => item.sign === -1).length >= 2);
  }
});

test("il grafico e privato, locale e richiede consenso verificato", () => {
  assert.match(component, /calculatePoliticalCompass\(answers\)/);
  assert.doesNotMatch(component, /fetch\s*\(|apiRequest\s*\(|localStorage|sessionStorage|indexedDB|postMessage/);
  assert.match(compassPage, /useProfileData\(undefined, \{ \.\.\.CLOSED_PROFILE_PANELS, opinions: true \}\)/);
  assert.match(compassPage, /!consentChecked/);
  assert.match(compassPage, /!consentGranted/);
  assert.match(compassPage, /<PoliticalCompassPreview answers=\{userOpinions\} standalone/);
  assert.match(compassPage, /overflow-y-auto/);
  assert.match(component, /non un test scientificamente validato/);
});

test("il pulsante e in fondo al Profilo personale e apre una route protetta", () => {
  assert.match(profile, /isViewingOwnProfile && !isEditing && displayUserInfo/);
  assert.match(profile, /href="\/compasso-politico"/);
  assert.match(profile, /data-testid="profilo-compasso-politico-link"/);
  assert.ok(profile.indexOf('href="/compasso-politico"') > profile.indexOf('<ProfileOpinions '));
  assert.doesNotMatch(profile, /<PoliticalCompassPreview/);
  assert.match(app, /import CompassoPolitico from "\.\/pages\/CompassoPolitico"/);
  assert.match(app, /<Route path="\/compasso-politico">\s*<ProtectedRoute path="\/compasso-politico" component=\{CompassoPolitico\}/);
  assert.match(compassPage, /href="\/profilo"/);
});

test("indecisione e scarsita di risposte non diventano coordinate", () => {
  assert.match(modelSource, /if \(answer === 0\) \{/);
  assert.match(modelSource, /answered >= 8 && negative\.length >= 2 && positive\.length >= 2/);
  assert.match(modelSource, /score = qualified\s*\?/);
  assert.match(component, /compass\?\.economy\.score !== null/);
  assert.match(component, /compass\?\.freedom\.score !== null/);
});

// Workflow CI: esbuild compila il modello TypeScript effettivamente importato
// dalla UI. Questi test controllano la funzione reale, non una sua riscrittura.
const compiled = process.env.COMPASS_MODEL_BUNDLE;
const runtimeTest = compiled ? test : test.skip;
const model = compiled ? require(path.resolve(compiled)) : null;

runtimeTest("i 28 metadati della funzione coincidono con la mappa verificata", () => {
  assert.equal(model.COMPASS_QUESTIONS.length, rules.length);
  assert.deepEqual(
    model.COMPASS_QUESTIONS.map(({ id, axis, direction }) => [id, axis, direction]),
    rules.map(({ id, axis, sign }) => [id, axis, sign]),
  );
});

runtimeTest("risposte sconosciute, mancanti o indecise non simulano neutralita", () => {
  assert.equal(model.readCompassAnswer("f"), 1);
  assert.equal(model.readCompassAnswer(" Contrario "), -1);
  assert.equal(model.readCompassAnswer("Indeciso"), 0);
  assert.equal(model.readCompassAnswer("Non lo so"), 0);
  assert.equal(model.readCompassAnswer(null), null);
  assert.equal(model.readCompassAnswer("ignoto"), null);
  const noAnswers = model.calculatePoliticalCompass({});
  assert.equal(noAnswers.economy.score, null);
  assert.equal(noAnswers.freedom.score, null);
  const undecided = Object.fromEntries(model.COMPASS_QUESTIONS.map(q => [q.id, "i"]));
  const uncertain = model.calculatePoliticalCompass(undecided);
  assert.equal(uncertain.economy.score, null);
  assert.equal(uncertain.freedom.score, null);
  assert.equal(uncertain.economy.answered, 0);
  assert.equal(uncertain.freedom.answered, 0);
});

runtimeTest("estremi: il calcolo resta tra -100 e +100 e inverte le risposte", () => {
  const negative = Object.fromEntries(model.COMPASS_QUESTIONS.map(q =>
    [q.id, q.direction === -1 ? "f" : "c"]));
  const positive = Object.fromEntries(model.COMPASS_QUESTIONS.map(q =>
    [q.id, q.direction === 1 ? "f" : "c"]));
  const left = model.calculatePoliticalCompass(negative);
  const right = model.calculatePoliticalCompass(positive);
  for (const axis of ["economy", "freedom"]) {
    assert.equal(left[axis].score, -100);
    assert.equal(right[axis].score, 100);
  }
});

runtimeTest("otto risposte non bastano se uno dei due poli e sottorappresentato", () => {
  const neg = model.COMPASS_QUESTIONS.filter(q => q.axis === "economia" && q.direction === -1);
  const pos = model.COMPASS_QUESTIONS.filter(q => q.axis === "economia" && q.direction === 1);
  const skew = Object.fromEntries([...neg.slice(0, 7), pos[0]].map(q => [q.id, "f"]));
  assert.equal(model.calculatePoliticalCompass(skew).economy.score, null);
  const balanced = Object.fromEntries([...neg.slice(0, 6), ...pos.slice(0, 2)].map(q => [q.id, "f"]));
  assert.equal(model.calculatePoliticalCompass(balanced).economy.answered, 8);
  assert.notEqual(model.calculatePoliticalCompass(balanced).economy.score, null);
});

runtimeTest("ID estranei e risposte aggiunte fuori catalogo non cambiano il risultato", () => {
  const answers = Object.fromEntries(model.COMPASS_QUESTIONS.map(q => [q.id, "f"]));
  assert.deepEqual(
    model.calculatePoliticalCompass({...answers, __foreign__: "c"}),
    model.calculatePoliticalCompass(answers),
  );
});
