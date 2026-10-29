import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { QueryClient } from "@tanstack/react-query";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const nav = read("lib/nav-items.ts");
const profile = read("pages/Profilo/index.tsx");
const hook = read("pages/Profilo/hooks/useProfileData.ts");
const government = read("pages/Profilo/components/ProfileGovernoIdeale.tsx");

const source = read("pages/Profilo/utils/profileSummaryCache.ts");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function localStorageMock() {
  const items = new Map();
  return {
    setItem: (key, value) => items.set(key, String(value)),
    getItem: key => items.get(key) ?? null,
    removeItem: key => items.delete(key),
    get length() { return items.size; },
    key: n => [...items.keys()][n] ?? null,
    items,
  };
}
function harness() {
  const localStorage = localStorageMock();
  const module = { exports: {} };
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    window: { localStorage },
    Date, JSON, Number, String,
    encodeURIComponent,
  });
  return { storage: localStorage, api: module.exports };
}

test("the first bottom nav item is Profile, with no Favorites or Settings tab", () => {
  const items = nav.slice(nav.indexOf("export const MAIN_NAV_ITEMS"));
  assert.match(items, /\[\s*\{\s*path: "\/profilo",\s*label: "Profilo"/);
  assert.doesNotMatch(items, /path: "\/preferiti"/);
  assert.doesNotMatch(items, /path: "\/impostazioni"/);
  assert.match(profile, /<Link href="\/preferiti"/);
  assert.match(profile, /<Link href="\/impostazioni"/);
});

test("all selection actions remain visible in open profile panels", () => {
  assert.match(profile, /<Link href="\/rappresentanti"/);
  assert.match(profile, /Scegli Rappresentanti/);
  assert.match(profile, /<Link href="\/candidati"/);
  assert.match(profile, /Scegli Candidati/);
  assert.match(government, /<Link href="\/governo"/);
  assert.match(government, /Scegli ministri/);
});

test("only allowlisted demographic summary is persisted, scoped to account", () => {
  const { api, storage } = harness();
  const full = {
    id: "account-1", nome: "Finto", cognome: "Utente",
    email: "private@example.invalid", telefono: "99999",
    ruolo: "E", status: "A", data_nascita: "12/01/1990",
    cittadinanza: "Italiana", regione_residenza: "Toscana",
    comune_residenza: "Comune Sintetico",
    energia_nucleare: "f", rappresentante_camera: "person-id",
    political_opinions_consent: true, password_hash: "private",
    avatar_config: '{"shirt":"blue"}',
  };
  api.storeProfileSummary(full.id, full);
  const raw = [...storage.items.values()].join("\n");
  for (const sensitive of [
    "private@example.invalid", "99999", "person-id", "password_hash",
    "energia_nucleare", "political_opinions_consent", '"nome"', '"cognome"',
  ]) assert.ok(!raw.includes(sensitive), "persisted sensitive value: " + sensitive);
  const restored = api.readProfileSummary("account-1");
  assert.equal(restored.user.data_nascita, "1990");
  assert.equal(restored.user.cittadinanza, "Italiana");
  assert.equal(restored.user.comune_residenza, "Comune Sintetico");
  assert.equal(api.readProfileSummary("account-2"), null);
  api.clearAllProfileSummaries();
  assert.equal(storage.length, 0);
});

test("expired summary is discarded and cannot silently stay current forever", () => {
  const { api, storage } = harness();
  api.storeProfileSummary("account-1", { id:"account-1", ruolo:"E", data_nascita:"1990" });
  const key = [...storage.items.keys()][0];
  const cache = JSON.parse(storage.getItem(key));
  cache.savedAt = Date.now() - api.PROFILE_SUMMARY_TTL_MS - 1;
  storage.setItem(key, JSON.stringify(cache));
  assert.equal(api.readProfileSummary("account-1"), null);
  assert.equal(storage.length, 0);
});

test("opening profile loads just summary; political API requests require expansion and consent", () => {
  assert.match(hook, /initialData: ownProfile \? saved\?\.user : undefined/);
  assert.match(hook, /staleTime: ownProfile \? PROFILE_SUMMARY_TTL_MS : 0/);
  assert.match(hook, /const politicalPanelOpen = panels\.representatives/);
  assert.match(hook, /enabled: enabled && ownProfile && politicalPanelOpen/);
  assert.match(hook, /const politicalAllowed = ownProfile && consent\.isSuccess/);
  assert.match(hook, /enabled: enabled && politicalAllowed && panels\.government/);
  assert.match(hook, /enabled: enabled && politicalAllowed && panels\.representatives/);
  assert.match(hook, /enabled: enabled && politicalAllowed && panels\.candidates/);
  assert.match(hook, /enabled: enabled && politicalAllowed && panels\.opinions/);
  assert.doesNotMatch(source, /userOpinions|governoIdeale|candidatiDetails|rappresentantiDetails/);
});

test("successful login and onboarding open Profile as the new home", () => {
  assert.doesNotMatch(read("hooks/useAuthLogin.ts"), /window\.location\.href = "\/preferiti"/);
  assert.match(read("hooks/useAuthLogin.ts"), /window\.location\.href = "\/profilo"/);
  assert.match(read("pages/registrazione-crea-passkey.tsx"), /window\.location\.href = "\/profilo"/);
  assert.match(read("pages/registrazione-3-residenza.tsx"), /navigate\("\/profilo"\)/);
  assert.match(read("pages/registrazione-ruolo.tsx"), /navigate\("\/profilo"\)/);
});

test("political disclosures reuse per-account RAM without permanent storage", async () => {
  // Verify the actual React Query cache semantics, as well as the hook wiring.
  assert.match(hook, /const POLITICAL_RAM_TTL_MS = 10 \* 60 \* 1000/);
  assert.match(hook, /const POLITICAL_RAM_GC_MS = 30 \* 60 \* 1000/);
  assert.match(hook, /const CONSENT_RAM_TTL_MS = 60 \* 1000/);
  assert.equal((hook.match(/staleTime: POLITICAL_RAM_TTL_MS/g) || []).length, 5);
  assert.equal((hook.match(/gcTime: POLITICAL_RAM_GC_MS/g) || []).length, 6);
  assert.equal((hook.match(/politicalEpoch, "(government|representatives|candidates|opinions)"/g) || []).length, 4);
  assert.match(hook, /queryKey: \["profileFull", ownerId, politicalPanelOpen \? politicalEpoch : "personal"\]/);
  assert.match(hook, /!consent\.isRefetchError/);
  assert.match(hook, /refetchOnWindowFocus: "always"/);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let sqlEquivalentCalls = 0;
  const load = async (ownerId, consentEpoch) => queryClient.fetchQuery({
    queryKey: ["profilePolitical", ownerId, consentEpoch, "government"],
    queryFn: async () => { sqlEquivalentCalls += 1; return { Primo_Ministro: "Figura sintetica" }; },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  await load("account-1", "consent-era-1");
  await load("account-1", "consent-era-1");
  assert.equal(sqlEquivalentCalls, 1, "reopening the same disclosure must not repeat the query");
  await load("account-2", "consent-era-1");
  assert.equal(sqlEquivalentCalls, 2, "another user must never inherit the same cache");
  await load("account-1", "consent-era-2");
  assert.equal(sqlEquivalentCalls, 3, "new consent epoch must never reuse the old answers");
  queryClient.removeQueries({ queryKey: ["profilePolitical", "account-1"] });
  await load("account-1", "consent-era-2");
  assert.equal(sqlEquivalentCalls, 4, "revocation invalidation must flush RAM results");
  queryClient.clear();
});

test("grant and revoke immediately invalidate all profile political caches", () => {
  for (const path of [
    "pages/GDPR/index.tsx",
    "components/PoliticalOpinionsConsentModal.tsx",
  ]) {
    const code = read(path);
    assert.match(code, /removeQueries\(\{ queryKey: \['profilePolitical'\] \}\)/);
    assert.match(code, /removeQueries\(\{ queryKey: \['profileFull'\] \}\)/);
    assert.match(code, /invalidateQueries\(\{ queryKey: \['profileConsent'\] \}\)/);
  }
});
