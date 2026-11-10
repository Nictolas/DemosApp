import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const code = ts.transpileModule(read("lib/avatar-access.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
runInNewContext(code, { module, exports: module.exports });
const { canEditPersonalAvatar, isPublicAvatarRole } = module.exports;

test("only active admins, DPOs, politicians and candidates can edit an avatar", () => {
  const active = { status: "a" };
  for (const field of ["is_admin", "is_dpo", "is_politician", "is_candidate"]) {
    assert.equal(canEditPersonalAvatar({ ...active, [field]: true }), true, field);
    assert.equal(canEditPersonalAvatar({ status: "s", [field]: true }), false, "inactive " + field);
  }
  for (const role of ["E", "A", "I", "O"]) {
    assert.equal(canEditPersonalAvatar({ ...active, ruolo: role }), false, role);
  }
  assert.equal(canEditPersonalAvatar(null), false);
  assert.equal(canEditPersonalAvatar({ ...active, is_admin: false, is_dpo: false }), false);
});

test("public avatar visibility excludes ordinary and administrative-only roles", () => {
  for (const role of ["P", "C", "CP", "Politico", "Candidato", "Candidato Politico"]) {
    assert.equal(isPublicAvatarRole(role), true, role);
  }
  for (const role of ["AD", "E", "A", "I", "O", undefined]) {
    assert.equal(isPublicAvatarRole(role), false, String(role));
  }
});

test("profile and standalone editor use the same verified capability gate", () => {
  const profile = read("pages/Profilo/index.tsx");
  const info = read("pages/Profilo/components/ProfileInfo.tsx");
  const editor = read("pages/ModificaImmagine.tsx");
  const header = read("components/DesktopAppHeader.tsx");
  assert.match(profile, /allowOwnAvatar=\{isViewingOwnProfile && canEditPersonalAvatar\(user\)\}/);
  assert.match(info, /isOwnProfile \? allowOwnAvatar : isPublicAvatarRole\(userInfo.ruolo\)/);
  assert.match(editor, /const hasPermission = canEditPersonalAvatar\(user\)/);
  assert.match(header, /enabled: !!user\?\.id && canUseAvatar/);
});

test("avatar endpoint rejects users without DB-authorized roles before writing", () => {
  const api = readFileSync(new URL("../../api/routes/users/profile.js", import.meta.url), "utf8");
  const start = api.indexOf("router.post('/me/avatar'");
  const end = api.indexOf("router.put('/me'", start);
  const route = api.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /getAccountSubject\(pool, userId\)/);
  assert.match(route, /AS is_dpo, u\.is_admin, u\.status FROM users u WHERE u\.id = \$1/);
  assert.match(route, /if \(!hasPoliticalOrAdminCapability && !hasDpoCapability\)/);
  assert.ok(route.indexOf("res.status(403)") < route.indexOf("UPDATE users SET avatar_config"));
});

test("admin editing endpoint cannot assign avatars to electors", () => {
  const admin = readFileSync(new URL("../../api/routes/users/search.js", import.meta.url), "utf8");
  const start = admin.indexOf("router.put('/:userId'");
  const route = admin.slice(start);
  assert.ok(start >= 0);
  assert.match(route, /if \(updateData\?\.avatar_config != null\)/);
  assert.match(route, /getAccountSubject\(pool, userId\)/);
  assert.match(route, /if \(!allowed\)/);
  assert.ok(route.indexOf("res.status(403)") < route.indexOf("UPDATE users SET"));
});

test("profile summary cache rejects voter avatar config", () => {
  const source = read("pages/Profilo/utils/profileSummaryCache.ts");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const cacheModule = { exports: {} };
  const data = new Map();
  const localStorage = {
    setItem: (key, value) => data.set(key, String(value)),
    getItem: key => data.get(key) ?? null,
    removeItem: key => data.delete(key),
    key: i => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
  runInNewContext(compiled, {
    module: cacheModule, exports: cacheModule.exports,
    window: { localStorage }, Date, JSON, Number, String, encodeURIComponent,
  });
  const { storeProfileSummary, readProfileSummary } = cacheModule.exports;
  storeProfileSummary("voter", { id: "voter", ruolo: "E", avatar_config: '{"hair":"blue"}' });
  assert.equal(readProfileSummary("voter").user.avatar_config, undefined);
  storeProfileSummary("dpo", { id: "dpo", ruolo: "E", can_have_avatar: true, avatar_config: '{"hair":"blue"}' });
  assert.ok(readProfileSummary("dpo").user.avatar_config);
});
