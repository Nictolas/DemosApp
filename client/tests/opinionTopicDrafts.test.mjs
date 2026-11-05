import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite/package.json"))("esbuild");
const output = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/opinionTopicDrafts.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const { rebaseTopicDrafts } = await import("data:text/javascript;base64," +
  Buffer.from(output.outputFiles[0].contents).toString("base64"));
const a = "owner-a|epoch-1|topic-1";
const b = "owner-b|epoch-1|topic-1";
const questions = [{ id: "one", userAnswer: "f" }, { id: "two", userAnswer: null }];

test("fresh snapshot shows only committed selections", () => {
  const x = rebaseTopicDrafts(null, a, questions);
  assert.equal(x.drafts.one, "f");
  assert.equal(x.drafts.two, undefined);
});

test("refetch keeps a pending draft and synchronizes untouched answers", () => {
  const x = rebaseTopicDrafts(null, a, questions);
  const edited = { ...x, drafts: { one: "c", two: "i" } };
  const y = rebaseTopicDrafts(edited, a, [{ id: "one", userAnswer: "f" },
    { id: "two", userAnswer: null }, { id: "three", userAnswer: "c" }]);
  assert.equal(y.drafts.one, "c");
  assert.equal(y.drafts.two, "i");
  assert.equal(y.drafts.three, "c");
  assert.equal(y.confirmed.two, null);
});

test("confirmed response resets dirty state and later changes follow server", () => {
  const x = rebaseTopicDrafts(null, a, questions);
  const edited = { ...x, drafts: { one: "c" } };
  const saved = rebaseTopicDrafts(edited, a, [{ id: "one", userAnswer: "c" }]);
  assert.equal(saved.drafts.one, saved.confirmed.one);
  assert.equal(rebaseTopicDrafts(saved, a, [{ id: "one", userAnswer: "f" }]).drafts.one, "f");
});

test("different user, consent epoch or topic cannot inherit previous drafts", () => {
  const x = rebaseTopicDrafts(null, a, questions);
  const edited = { ...x, drafts: { one: "c", two: "i" } };
  for (const scope of [b, "owner-a|epoch-2|topic-1", "owner-a|epoch-1|topic-2"]) {
    const next = rebaseTopicDrafts(edited, scope, questions);
    assert.equal(next.drafts.one, "f");
    assert.equal(next.drafts.two, undefined);
  }
});

test("removed questions and invalid draft values are discarded", () => {
  const x = rebaseTopicDrafts(null, a, questions);
  const edited = { ...x, drafts: { one: "other", two: "c" } };
  const next = rebaseTopicDrafts(edited, a, [{ id: "one", userAnswer: "i" }]);
  assert.equal(next.drafts.one, "i");
  assert.equal(next.drafts.two, undefined);
});
