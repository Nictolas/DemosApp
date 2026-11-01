"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "client/src/lib/opinionBadgesModel.ts"), "utf8");
const catalog = Array.from({ length: 6 }, (_, i) =>
  JSON.parse(fs.readFileSync(path.join(root, "api/catalog/opinions-part-0" + i + ".json"), "utf8"))
).flat();
const compiled = process.env.BADGE_MODEL_BUNDLE;
const model = compiled ? require(path.resolve(compiled)) : null;
const run = model ? test : test.skip;
const permitted = Object.freeze({
  isOwner: true, politicalConsentVerified: true,
  badgeConsentVerified: true, releaseGateApproved: true,
});
const rule = id => ({ ...model.BADGE_RULES.find(x => x.id === id), approved: true });
const mk = (r, positions) => Object.fromEntries(
  Object.entries(positions).map(([index, answer]) => [r.questions[Number(index)].opinionId, answer])
);
const out = (r, positions, access = permitted) => model.evaluateOpinionBadge(r, mk(r, positions), access);

test("il prototipo resta isolato e non esegue rete, storage o log", () => {
  assert.doesNotMatch(source, /\b(fetch|apiRequest|localStorage|sessionStorage|indexedDB|console\.log|postMessage)\b/);
  assert.doesNotMatch(source, /^import\s/m);
  assert.match(source, /approved: false/);
});

test("catalogo canonico di 94 ID: mappatura 24 associata alle sole cinque etichette", () => {
  assert.equal(catalog.length, 94);
  assert.equal(new Set(catalog.map(x => x.id)).size, 94);
  const known = new Set(catalog.map(x => x.id));
  // Test statico sul testo: anche senza compilatore i riferimenti sono verificabili.
  const mapped = Array.from(source.matchAll(/\["([a-z0-9_]+)", "(f|c)", "[a-z0-9-]+"\]/g));
  assert.equal(mapped.length, 24);
  assert.equal(new Set(mapped.map(x => x[1])).size, 24);
  for (const [, id] of mapped) assert.ok(known.has(id), "ID estraneo: " + id);
  for (const id of ["citta_30", "riduzione_dell_illuminazione_notturna_per_risparmio_energetico",
    "centri_migranti_estero", "nato", "spese_nato_5_percento"]) {
    assert.ok(!mapped.some(x => x[1] === id), "Esclusione non rispettata: " + id);
  }
});

run("nessuna regola e approvata ed il motore non produce alcuna inferenza di default", () => {
  assert.equal(model.BADGE_RULES.length, 5);
  assert.deepEqual(model.BADGE_RULES.map(x => x.questions.length), [5, 4, 4, 5, 6]);
  for (const item of model.BADGE_RULES) {
    assert.equal(item.approved, false);
    assert.equal(model.evaluateOpinionBadge(item, {}, permitted), null);
  }
});

run("mancanza di uno dei quattro permessi e gate che impedisce di leggere answers", () => {
  const r = rule("B01");
  for (const key of Object.keys(permitted)) {
    const access = { ...permitted, [key]: false };
    const unreadable = new Proxy({}, { get() { throw Error("answer read without gate"); } });
    assert.equal(model.evaluateOpinionBadge(r, unreadable, access), null);
  }
  assert.equal(model.evaluateOpinionBadge(model.BADGE_RULES[0], {}, permitted), null);
});

run("normalizzazione difensiva: f, c, i, indecisi, assenti e ignoti", () => {
  assert.equal(model.normalizeBadgeAnswer(" FAVOREVOLE "), "f");
  assert.equal(model.normalizeBadgeAnswer("Contrario"), "c");
  assert.equal(model.normalizeBadgeAnswer("non lo so"), "i");
  assert.equal(model.normalizeBadgeAnswer("non_lo_so"), "i");
  assert.equal(model.normalizeBadgeAnswer("non-lo-so"), "i");
  assert.equal(model.normalizeBadgeAnswer(null), null);
  assert.equal(model.normalizeBadgeAnswer(1), null);
  assert.equal(model.normalizeBadgeAnswer("ignoto"), null);
});

run("due risposte animaliste non bastano", () => {
  const r = rule("B01");
  const res = out(r, {0:"c", 1:"c"});
  assert.equal(res.eligible, false);
  assert.equal(res.decisive, 2);
  assert.equal(res.coverage, 0.4);
});

run("tre risposte coerenti su cinque e tre temi distinti consentono soltanto la simulazione", () => {
  const r = rule("B01");
  const res = out(r, {0:"c",1:"c",2:"c"});
  assert.equal(res.eligible, true);
  assert.equal(res.coverage, 0.6);
  assert.equal(res.coherence, 1);
  assert.equal(res.distinctTopics, 3);
  assert.equal(res.evidence.length, 3);
});

run("tre favorevoli e due contrari rispetto alla targhetta non superano coerenza 75%", () => {
  const r = rule("B01");
  const res = out(r, {0:"c",1:"c",2:"c",3:"f",4:"f"});
  assert.equal(res.coherence, 0.6);
  assert.equal(res.eligible, false);
  assert.equal(res.contradictory, 2);
});

run("tre posizioni coerenti e una contraria superano esattamente 75%", () => {
  const r = rule("B01");
  const res = out(r, {0:"c",1:"c",2:"c",3:"f"});
  assert.equal(res.coherence, 0.75);
  assert.equal(res.eligible, true);
});

run("indecisi e valori sconosciuti non contano come decisive", () => {
  const r = rule("B01");
  const uncertain = out(r,{0:"i",1:"non lo so",2:"indeciso",3:"i",4:"i"});
  assert.equal(uncertain.decisive,0);
  assert.equal(uncertain.undecided,5);
  assert.equal(uncertain.coherence,null);
  assert.equal(uncertain.eligible,false);
  const empty = out(r,{0:"ignoto",1:null});
  assert.equal(empty.decisive,0);
  assert.equal(empty.missing,5);
});

run("una categoria con tre domande nello stesso sotto-tema non puo essere emessa", () => {
  const r = rule("B02");
  const reduced = {...r,questions:r.questions.slice(0,3).map(q=>({...q,topic:"solo-un-tema"}))};
  const res = out(reduced,{0:"f",1:"f",2:"f"});
  assert.equal(res.distinctTopics,1);
  assert.equal(res.eligible,false);
});

run("ambiente: quattro domande valide; illuminazione esclusa", () => {
  const r = rule("B02");
  assert.equal(r.questions.length,4);
  assert.ok(r.questions.every(q=>q.opinionId!=="riduzione_dell_illuminazione_notturna_per_risparmio_energetico"));
  assert.equal(out(r,{0:"f",1:"f",2:"f"}).eligible,true);
  const onlyTwo = {
    potenziare_rinnovabili:"f",
    verde_pubblico_e_giardini:"f",
    riduzione_dell_illuminazione_notturna_per_risparmio_energetico:"f",
  };
  assert.equal(model.evaluateOpinionBadge(r,onlyTwo,permitted).eligible,false);
});

run("mobilita: Citta 30 esclusa e tre risposte coerenti bastano", () => {
  const r = rule("B03");
  assert.ok(r.questions.every(q=>q.opinionId!=="citta_30"));
  assert.equal(out(r,{0:"f",1:"f",2:"f"}).eligible,true);
});

run("welfare: tre risposte su sei NON raggiungono copertura 60%", () => {
  const r = rule("B05");
  assert.equal(out(r,{0:"f",1:"f",2:"f"}).eligible,false);
  const four = out(r,{0:"f",1:"f",2:"f",3:"f"});
  assert.equal(four.eligible,true);
  assert.equal(four.decisive,4);
  assert.ok(four.coverage>0.6);
});

run("per la diversita nidi e sostegno al reddito costituiscono un solo sotto-tema ciascuno", () => {
  const r = rule("B05");
  const res = out(r,{1:"f",2:"f",4:"f",5:"f"});
  assert.equal(res.distinctTopics,2);
  assert.equal(res.eligible,true);
  const oneTopic = {...r,questions:r.questions.filter(q=>q.topic==="servizi-infanzia")};
  assert.equal(out(oneTopic,{0:"f",1:"f"}).eligible,false);
});

run("non usare risposte estranee o cambiare l'ordine delle evidenze", () => {
  const r = rule("B01");
  const basic = model.evaluateOpinionBadge(r, mk(r,{0:"c",1:"c",2:"c"}),permitted);
  const more = model.evaluateOpinionBadge(r, {...mk(r,{0:"c",1:"c",2:"c"}),_fake:"f"},permitted);
  assert.deepEqual(more,basic);
  assert.deepEqual(more.evidence.map(x=>x.opinionId),r.questions.slice(0,3).map(x=>x.opinionId));
});

run("la versione delle regole e esplicita e il calcolo produce solo un oggetto in memoria", () => {
  assert.match(model.BADGE_RULES_VERSION,/^\d{4}-\d{2}-\d{2}-draft-\d+$/);
  const res = out(rule("B04"),{0:"f",1:"f",2:"f"});
  assert.equal(res.version, model.BADGE_RULES_VERSION);
  assert.equal(res.badgeId, "B04");
  assert.equal(res.eligible, true);
});
