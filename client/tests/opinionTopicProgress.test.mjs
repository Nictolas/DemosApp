import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const catalog = Array.from({ length: 6 }, (_, i) =>
  JSON.parse(readFileSync(new URL(`api/catalog/opinions-part-0${i}.json`, root), "utf8"))
).flat();

const output = await build({
  entryPoints: [new URL("../src/lib/opinionTopicProgress.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", write: false,
  logLevel: "silent",
});
const loaded = await import("data:text/javascript;base64," + Buffer.from(output.outputFiles[0].contents).toString("base64"));
const { calculateOpinionTopicProgress, topicProgressFromEncryptedProfile } = loaded;
const source = readFileSync(new URL("../src/lib/opinionTopics.ts", import.meta.url), "utf8");
const match = source.match(/export const OPINION_TOPIC_BY_ID:[\s\S]*?Object\.freeze\((\{[\s\S]*?\})\);/);
assert.ok(match);
const mapping = JSON.parse(match[1]);
const epoch = "verified-epoch-for-test-only";
const revision = "a".repeat(64);
const gradeSections = { E: "opinionE", N: "opinionN", R: "opinionR", CO: "opinionCO" };
function snapshot(overrides = {}) {
  const profile = { version: 1, consent: { granted: true, timestamp: epoch } };
  for (const [grade, section] of Object.entries(gradeSections)) {
    profile[section] = {
      version: 1, catalogRevision: revision, grade,
      questions: catalog.filter((q) => q.gradi_opinione.includes(grade)).map((q) => ({
        id: q.id, text: q.text, userAnswer: null,
      })),
    };
  }
  return Object.assign(profile, overrides);
}

test("zero, 50 and 100 percent derive from committed answers only", () => {
  const ids = Object.keys(mapping);
  const base = ids.map(id => ({ id, userAnswer: null }));
  const empty = calculateOpinionTopicProgress(base);
  for (const entry of Object.values(empty)) assert.equal(entry.percent, 0);
  const firstTopic = mapping[ids[0]];
  const inTopic = ids.filter(id => mapping[id] === firstTopic);
  const partial = calculateOpinionTopicProgress(base.map((q) => ({
    ...q, userAnswer: inTopic.indexOf(q.id) < Math.ceil(inTopic.length / 2) ? "i" : null,
  })));
  assert.equal(partial[firstTopic].completed, Math.ceil(inTopic.length / 2));
  const full = calculateOpinionTopicProgress(base.map((q) => ({ ...q, userAnswer: "f" })));
  assert.equal(Object.values(full).reduce((a, b) => a + b.completed, 0), 94);
  for (const entry of Object.values(full)) assert.equal(entry.percent, 100);
});

test("one ID is counted once across geographic levels", () => {
  const id = catalog.find(q => q.gradi_opinione.length > 1).id;
  const value = calculateOpinionTopicProgress([{ id, userAnswer: "c" }, { id, userAnswer: "c" }]);
  assert.equal(value[mapping[id]].completed, 1);
});

test("vault snapshot refuses unverified consent, missing coverage or incompatible answers", () => {
  const p = snapshot();
  assert.ok(topicProgressFromEncryptedProfile(p, epoch));
  assert.equal(topicProgressFromEncryptedProfile(p, "other-epoch"), null);
  assert.equal(topicProgressFromEncryptedProfile({ ...p, consent: { granted: false, timestamp: epoch } }, epoch), null);
  assert.equal(topicProgressFromEncryptedProfile({ ...p, opinionCO: null }, epoch), null);
  const multi = catalog.find(q => q.gradi_opinione.length > 1);
  const first = gradeSections[multi.gradi_opinione[0]];
  const second = gradeSections[multi.gradi_opinione[1]];
  if (first && second) {
    const broken = snapshot();
    broken[first].questions.find(q => q.id === multi.id).userAnswer = "f";
    broken[second].questions.find(q => q.id === multi.id).userAnswer = "c";
    assert.equal(topicProgressFromEncryptedProfile(broken, epoch), null);
  }
});

test("topic logic has no network, new persistent storage or new SQL", () => {
  const progressSource = readFileSync(new URL("../src/lib/opinionTopicProgress.ts", import.meta.url), "utf8");
  assert.doesNotMatch(progressSource, /apiRequest|fetch\s*\(|localStorage|indexedDB|supabase|SELECT\s+/i);
});
