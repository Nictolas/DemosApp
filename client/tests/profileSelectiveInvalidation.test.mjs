import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const source = read("lib/profileMutationPolicy.ts");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
runInNewContext(compiled, { module, exports: module.exports });
const impact = module.exports.profileMutationImpact;
const sections = (method, path) => [...(impact(method, path)?.sections || [])];

test("unrelated preferences survive a government or opinion update", () => {
  assert.deepEqual(sections("POST", "/api/governo/vota"), ["government"]);
  assert.equal(impact("PUT", "/api/governo/attuale/ministro"), null);
  assert.deepEqual(sections("POST", "/api/opinioni/risposte"), ["opinions", "full"]);
});
test("civic favorites invalidate only the private preferences snapshot", () => {
  for (const path of [
    "/api/capo-stato/vota", "/api/grazia/vota", "/api/amnistia/vota",
    "/api/iniziative-popolari/vota", "/api/sostenitori/follow",
    "/api/sostenitori/unfollow-organizzazione",
    "/api/organizzazioni/sostenitori", "/api/attivisti/sostenitori",
  ]) assert.deepEqual(sections("POST", path), ["preferences"], path);
});
test("account edits only invalidate personal information, not political choices", () => {
  assert.deepEqual(sections("PUT", "/api/users/me"), ["full"]);
  assert.equal(impact("PUT", "/api/users/me").summary, true);
  assert.equal(impact("POST", "/api/users/another-user/ban", "owner-1"), null);
  assert.deepEqual(
    [...impact("PUT", "/api/users/owner-1", "owner-1").sections], ["full"]);
  assert.equal(impact("PUT", "/api/users/owner-1", "owner-1").summary, true);
});
test("no invalidation on reads or unrelated writes", () => {
  assert.equal(impact("GET", "/api/capo-stato"), null);
  assert.equal(impact("POST", "/api/avvistamenti"), null);
});
test("consent changes remain full-security invalidation events", () => {
  const result = impact("DELETE", "/api/user/political-opinions-consent");
  assert.equal(result.consent, true);
  assert.equal(result.summary, false);
});
test("profile hook records revisions before the GET and uses them on encrypted writes", () => {
  const hook = read("pages/Profilo/hooks/useProfileData.ts");
  const vault = read("pages/Profilo/utils/encryptedProfileVault.ts");
  const requester = read("lib/queryClient.ts");
  assert.match(vault, /export function profileSectionRevision/);
  assert.match(vault, /export async function invalidateEncryptedProfileSections/);
  assert.match(hook, /profileSectionRevision\(ownerId, "full"\)/);
  assert.match(hook, /profileSectionRevision\(ownerId, "preferences"\)/);
  assert.match(hook, /profileSectionRevision\(ownerId, "government"\)/);
  assert.match(hook, /profileSectionRevision\(ownerId, "representatives"\)/);
  assert.match(hook, /profileSectionRevision\(ownerId, "candidates"\)/);
  assert.match(hook, /profileSectionRevision\(ownerId, "opinions"\)/);
  assert.match(requester, /invalidateEncryptedProfileSections\(ownerId, impact.sections\)/);
  assert.match(requester, /profileMutationImpact\(method, url, ownerId\)/);
});
