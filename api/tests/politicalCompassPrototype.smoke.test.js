const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const modelSource = fs.readFileSync(path.join(root, "client/src/lib/politicalCompassModel.ts"), "utf8");
const component = fs.readFileSync(
  path.join(root, "client/src/pages/Profilo/components/PoliticalCompassPreview.tsx"), "utf8");
const profile = fs.readFileSync(path.join(root, "client/src/pages/Profilo/index.tsx"), "utf8");
const profileHook = fs.readFileSync(path.join(root, "client/src/pages/Profilo/hooks/useProfileData.ts"), "utf8");
const compassPage = fs.readFileSync(path.join(root, "client/src/pages/CompassoPolitico.tsx"), "utf8");
const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
const privacyNotice = fs.readFileSync(path.join(root, "client/src/pages/PrivacyPolicy.tsx"), "utf8");
const consentScreens = [
  "client/src/pages/registrazione-consensi.tsx",
  "client/src/pages/registrazione-consensi-opinioni.tsx",
  "client/src/components/PoliticalOpinionsConsentModal.tsx",
].map(filename => fs.readFileSync(path.join(root, filename), "utf8"));

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
  // I metadati restano nel modello, senza una sezione metodologica nel profilo.
  assert.doesNotMatch(component, /Quali Opinioni vengono usate e come\\?|<details|<summary/);
  assert.doesNotMatch(component, /COMPASS_QUESTIONS|readCompassAnswer|answerLabel/);
  assert.match(modelSource, /export const COMPASS_QUESTIONS/);
});

test("cinque simboli neutri identificano i temi senza alterare il calcolo", () => {
  assert.ok(component.includes('import { FlaskConical, Globe2, Landmark, Leaf, Scale, UsersRound } from "lucide-react"'));
  for (const [id, icon] of Object.entries({
    economia: "Scale",
    stato: "Landmark",
    costumi: "UsersRound",
    ambiente: "Leaf",
    immigrazione: "Globe2",
  })) {
    assert.ok(component.includes(id + ": " + icon + ","), id + " deve avere la propria icona");
  }
  assert.ok(component.includes("const AxisIcon = AXIS_ICONS[axis.id]"));
  assert.ok(component.includes('<AxisIcon className="h-4 w-4" />'));
  assert.ok(component.includes('aria-hidden="true">'));
  assert.ok(component.includes("{axis.title}"));
  assert.ok(component.includes('role="meter"'), "Le barre e i punteggi devono rimanere invariati");
});

test("cinque assi tematici sotto il compasso, senza ulteriori richieste o dettagli personali", () => {
  assert.match(component, /calculatePoliticalAxes\(answers\)/);
  assert.match(component, /visible \? calculatePoliticalAxes\(answers\) : null/);
  assert.match(component, /POLITICAL_AXES\.map\(\(axis\) =>/);
  assert.match(component, /I tuoi orientamenti politici/);
  assert.match(component, /aria-label="I tuoi orientamenti politici"/);
  assert.match(component, /role="meter"/);
  assert.match(component, /Dati insufficienti/);
  assert.match(component, /Non sono un test validato/);
  assert.doesNotMatch(component, /Quali Opinioni vengono usate e come\?|<details|<summary/);
  assert.ok(
    component.indexOf("I tuoi orientamenti politici") > component.indexOf('<figure className='),
    "Le barre devono essere sotto il grafico classico",
  );
  assert.doesNotMatch(component, /grid grid-cols-1 gap-2 sm:grid-cols-2/);
  assert.doesNotMatch(component, /<h4[^>]*>Libertà individuali<\/h4>/);
});

test("un unico avviso sperimentale in alto senza badge duplicati o due schede dei punteggi", () => {
  assert.match(component, /role="note" aria-label="Sezione sperimentale"/);
  assert.match(component, /<p className="text-sm font-semibold text-amber-950">Sezione sperimentale<\/p>/);
  assert.equal((component.match(/>Sezione sperimentale<\/p>/g) || []).length, 1);
  assert.ok(component.indexOf('aria-label="Sezione sperimentale"') < component.indexOf("La tua posizione politica"));
  assert.ok(component.indexOf("La tua posizione politica") < component.indexOf("<figure"));
  assert.ok(component.indexOf("<figure") < component.indexOf("I tuoi orientamenti politici"));
  assert.doesNotMatch(component, /Compasso sperimentale|axis\.experimental|>Sperimentale<|<h4[^>]*>Libertà individuali<\/h4>/);
  assert.doesNotMatch(component, /resultLabel\(compass\.|grid grid-cols-1 gap-2 sm:grid-cols-2/);
  assert.match(component, /POLITICAL_AXES\.map/);
  assert.match(component, /aria-label="Posizione stimata su due assi esplorativi:/);
  assert.match(component, /role="meter"/);
});

test("informativa distingue profilazione locale facoltativa da profilazione commerciale", () => {
  assert.match(privacyNotice, /Compasso politico e indicatori tematici/);
  assert.match(privacyNotice, /id="4\.1"/, "Il link della registrazione deve puntare a una sezione reale dell’informativa");
  assert.match(privacyNotice, /profilazione ai sensi del GDPR/);
  assert.match(privacyNotice, /senza salvare i punteggi nel database/);
  assert.match(privacyNotice, /Senza consenso alle Opinioni politiche/);
  assert.match(privacyNotice, /non vengono utilizzati[\s\S]*per decisioni automatizzate/);
  assert.match(privacyNotice, /Nessuna profilazione commerciale o vendita/);
  assert.doesNotMatch(privacyNotice, /Nessuna profilazione o vendita dati individuali/);
});

test("tutti i consensi informano sul compasso facoltativo senza nuove raccolte", () => {
  assert.equal(consentScreens.length, 3);
  for (const screen of consentScreens) {
    assert.match(screen, /Compasso politico/);
    assert.match(screen, /cinque indicatori/);
    assert.match(screen, /dispositivo/);
    assert.match(screen, /server/);
  }
  assert.match(privacyNotice, /Non vengono aggiunte nuove domande obbligatorie/);
  assert.match(privacyNotice, /calcolo viene eseguito nel browser o nell'app sul dispositivo/);
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

test("quattro colori classici e posizione convenzionale dei quadranti", () => {
  // Il compasso classico ha restrizioni in alto e libertà in basso;
  // il segno del punteggio di libertà resta invariato, cambia solo il verso Y del SVG.
  const quadrants = [
    ['restrizioni-interventi-pubblici', '55', '35', '#ef4444'],
    ['restrizioni-soluzioni-private', '180', '35', '#3b82f6'],
    ['liberta-interventi-pubblici', '55', '160', '#22c55e'],
    ['liberta-soluzioni-private', '180', '160', '#a855f7'],
  ];
  for (const [name, x, y, fill] of quadrants) {
    assert.ok(component.includes(
      `<rect x="${x}" y="${y}" width="125" height="125" fill="${fill}" data-quadrant="${name}" />`
    ), `Quadrante errato: ${name}`);
  }
  assert.match(component, /cy=\{160 \+ \(compass\.freedom\.score \|\| 0\) \* 1\.25\}/);
  assert.match(component, /<text x="180" y="20"[^>]*>Autorità<\/text>/);
  assert.match(component, /<text x="180" y="307"[^>]*>Libertà<\/text>/);
  assert.match(component, /<text x="30" y="160" transform="rotate\(-90 30 160\)"[^>]*>Sinistra<\/text>/);
  assert.match(component, /<text x="330" y="160" transform="rotate\(90 330 160\)"[^>]*>Destra<\/text>/);
  assert.match(component, /viewBox="0 0 360 320"/);
  assert.match(component, /className="mx-auto block h-auto w-full max-w-sm"/);
  assert.match(component, /aria-label="Posizione stimata su due assi esplorativi:/);
  assert.doesNotMatch(component, /Maggiori restrizioni|Maggiori libertà individuali|Soluzioni private \/ gare/);
  assert.match(component, /r="9" fill="#111827" stroke="#ffffff" strokeWidth="3"/);
});

test("il Compasso richiede risposte private e non riusa la cache legacy del solo catalogo", () => {
  assert.match(profileHook, /\/api\/opinioni\/profile\?includeAnswers=1/);
  assert.match(profileHook, /snapshot\.opinions\?\.answersLoaded === true/);
  assert.match(profileHook, /Risposte personali non disponibili/);
  assert.match(profileHook, /answersLoaded: true as const/);
  assert.doesNotMatch(profileHook, /payload\.userAnswers \|\| \{\}/);
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


runtimeTest("cinque assi con ID validi, mappature senza duplicati e soglie coerenti", () => {
  assert.deepEqual(model.POLITICAL_AXES.map(axis => axis.id),
    ["economia", "stato", "costumi", "ambiente", "immigrazione"]);
  const known = new Set(catalog.map(entry => entry.id));
  for (const axis of model.POLITICAL_AXES) {
    const ids = axis.questions.map(question => question.id);
    assert.equal(new Set(ids).size, ids.length, `Doppioni su ${axis.id}`);
    assert.ok(axis.minAnswers >= 3);
    assert.ok(axis.minAnswers <= axis.questions.length);
    assert.ok(axis.minLeft > 0);
    assert.ok(axis.questions.filter(q => q.direction === -1).length >= axis.minLeft);
    assert.ok(axis.questions.filter(q => q.direction === 1).length >= axis.minRight);
    for (const question of axis.questions) {
      assert.ok(known.has(question.id), `ID non valido: ${axis.id}/${question.id}`);
      assert.ok([-1, 1].includes(question.direction));
    }
  }
  assert.equal(model.POLITICAL_AXES.find(axis => axis.id === "immigrazione").experimental, true);
  assert.equal(model.POLITICAL_AXES.find(axis => axis.id === "costumi").experimental, true);
});

runtimeTest("cinque assi: risposte mancanti e indecise non diventano falsi punteggi", () => {
  const empty = model.calculatePoliticalAxes({});
  const uncertain = model.calculatePoliticalAxes(
    Object.fromEntries(model.POLITICAL_AXES.flatMap(axis => axis.questions.map(q => [q.id, "i"]))),
  );
  for (const axis of model.POLITICAL_AXES) {
    assert.equal(empty[axis.id].score, null);
    assert.equal(empty[axis.id].leftPercent, null);
    assert.equal(empty[axis.id].rightPercent, null);
    assert.equal(uncertain[axis.id].score, null);
    assert.equal(uncertain[axis.id].answered, 0);
    assert.equal(uncertain[axis.id].undecided, axis.questions.length);
  }
});

runtimeTest("cinque assi: estremi, inversione delle risposte e percentuali complementari", () => {
  for (const axis of model.POLITICAL_AXES) {
    const leftVotes = Object.fromEntries(axis.questions.map(q => [q.id, q.direction === -1 ? "f" : "c"]));
    const rightVotes = Object.fromEntries(axis.questions.map(q => [q.id, q.direction === 1 ? "f" : "c"]));
    const left = model.scorePoliticalAxis(axis, leftVotes);
    const right = model.scorePoliticalAxis(axis, rightVotes);
    assert.equal(left.score, -100, axis.id);
    assert.equal(left.leftPercent, 100, axis.id);
    assert.equal(left.rightPercent, 0, axis.id);
    assert.equal(right.score, 100, axis.id);
    assert.equal(right.leftPercent, 0, axis.id);
    assert.equal(right.rightPercent, 100, axis.id);
    assert.equal(left.answered, axis.questions.length);
    assert.equal(right.answered, axis.questions.length);
  }
});

runtimeTest("i poli numericamente sbilanciati non spostano artificialmente il punteggio", () => {
  const economy = model.POLITICAL_AXES.find(axis => axis.id === "economia");
  // Si approvano proposte da entrambi i gruppi, ma il gruppo sinistro ha
  // più domande. I due poli devono compensarsi come nel compasso principale.
  const allFavourable = Object.fromEntries(economy.questions.map(q => [q.id, "f"]));
  const result = model.scorePoliticalAxis(economy, allFavourable);
  assert.equal(result.score, 0);
  assert.equal(result.leftPercent, 50);
  assert.equal(result.rightPercent, 50);
});

runtimeTest("immigrazione non mostra punteggio con solo risposte di accoglienza", () => {
  const immigration = model.POLITICAL_AXES.find(axis => axis.id === "immigrazione");
  const leftOnly = Object.fromEntries(
    immigration.questions.filter(q => q.direction === -1).map(q => [q.id, "f"]),
  );
  const result = model.scorePoliticalAxis(immigration, leftOnly);
  assert.equal(result.answered, 3);
  assert.equal(result.rightAnswered, 0);
  assert.equal(result.score, null);
});

runtimeTest("risposte estranee non cambiano gli orientamenti e i calcoli restano locali", () => {
  const answers = Object.fromEntries(
    model.POLITICAL_AXES.flatMap(axis => axis.questions.map(q => [q.id, "f"])),
  );
  assert.deepEqual(
    model.calculatePoliticalAxes({ ...answers, __foreign__: "c" }),
    model.calculatePoliticalAxes(answers),
  );
});
