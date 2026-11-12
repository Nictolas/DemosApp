import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const source = read("lib/avatarEligibility.ts");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
runInNewContext(compiled, { module, exports: module.exports });
const allowed = module.exports.canHaveProfileAvatar;

test("elettore and DPO never have profile avatar or empty placeholder", () => {
  for (const role of ["E", "Elettore", "A", "Attivista", "I", "O", "", null, "DPO"]) {
    assert.equal(allowed(role, false, false), false, String(role));
  }
  assert.equal(allowed("E", false, true), false);
  assert.equal(allowed("P", false, true), false, "DPO-only role overrides a legacy political label");
  assert.equal(allowed("AD", false, true), false, "An Admin text label must not bypass verified capabilities");
  assert.equal(allowed("AD", false, false), false);
});

test("Admin, politicians and candidates remain eligible", () => {
  for (const role of ["P", "C", "CP", "Politico", "Candidato", "Candidato Politico"]) {
    assert.equal(allowed(role, false, false), true, role);
  }
  assert.equal(allowed("E", true, false), true, "Verified Admin");
  assert.equal(allowed("AD", true, true), true, "Verified Admin takes precedence");
});

test("profile completely removes avatar box for elector and preserves personal details", () => {
  const profileInfo = read("pages/Profilo/components/ProfileInfo.tsx");
  const profile = read("pages/Profilo/index.tsx");
  const editor = read("pages/ModificaImmagine.tsx");
  assert.match(profileInfo, /canShowAvatar = false/);
  assert.match(profileInfo, /\{canShowAvatar && \(\s*<div className="relative shrink-0"/);
  assert.match(profileInfo, /<Dialog open=\{canShowAvatar && showAvatarDialog\}/);
  assert.doesNotMatch(profileInfo, /const canShowAvatar = true/);
  assert.match(profileInfo, /aria-label="Modifica profilo"/);
  assert.match(profileInfo, /Anno di nascita non specificato/);
  assert.match(profile, /canShowAvatar=\{canHaveProfileAvatar\(/);
  assert.match(profile, /isViewingOwnProfile && hasAdminCapability\(user\)/);
  assert.match(profile, /isViewingOwnProfile && hasDpoCapability\(user\)/);
  assert.match(editor, /const hasPermission = canHaveProfileAvatar\(/);
  assert.match(editor, /if \(!isLoadingInfo && !hasPermission\)/);
});
