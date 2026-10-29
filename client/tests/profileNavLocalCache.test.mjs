import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";


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

test("summary does not expire with time", () => {
  const { api, storage } = harness();
  api.storeProfileSummary("account-1", { id:"account-1", ruolo:"E", data_nascita:"1990" });
  const key = [...storage.items.keys()][0];
  const cache = JSON.parse(storage.getItem(key));
  cache.savedAt = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000;
  storage.setItem(key, JSON.stringify(cache));
  assert.equal(api.PROFILE_SUMMARY_TTL_MS, Infinity);
  assert.equal(api.readProfileSummary("account-1").user.data_nascita, "1990");
  api.clearProfileSummary("account-1");
  assert.equal(api.readProfileSummary("account-1"), null);
});

test("opening profile loads just summary; political API requests require expansion and consent", () => {
  assert.match(hook, /initialData: ownProfile \? saved\?\.user : undefined/);
  assert.match(hook, /staleTime: ownProfile \? PROFILE_SUMMARY_TTL_MS : 0/);
  assert.match(hook, /const politicalPanelOpen = panels\.representatives/);
  assert.match(hook, /const consentVerified = isSessionVerified && verifiedPoliticalConsent !== null/);
  assert.match(hook, /const politicalAllowed = ownProfile && vaultReady && consentVerified/);
  assert.match(hook, /enabled: enabled && vaultReady && politicalAllowed && panels\.government/);
  assert.match(hook, /enabled: enabled && vaultReady && politicalAllowed && panels\.representatives/);
  assert.match(hook, /enabled: enabled && vaultReady && politicalAllowed && panels\.candidates/);
  assert.match(hook, /enabled: enabled && vaultReady && politicalAllowed && panels\.opinions/);
  assert.doesNotMatch(source, /userOpinions|governoIdeale|candidatiDetails|rappresentantiDetails/);
});

test("successful login and onboarding open Profile as the new home", () => {
  assert.doesNotMatch(read("hooks/useAuthLogin.ts"), /window\.location\.href = "\/preferiti"/);
  assert.match(read("hooks/useAuthLogin.ts"), /window\.location\.href = "\/profilo"/);
  assert.match(read("pages/registrazione-crea-passkey.tsx"), /window\.location\.href = "\/profilo"/);
  assert.match(read("pages/registrazione-3-residenza.tsx"), /navigate\("\/profilo"\)/);
  assert.match(read("pages/registrazione-ruolo.tsx"), /navigate\("\/profilo"\)/);
});

test("political panels use a persistent encrypted vault and do not expire", () => {
  const vault = read("pages/Profilo/utils/encryptedProfileVault.ts");
  assert.match(vault, /AES-GCM/);
  assert.match(vault, /indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(vault, /additionalData: new TextEncoder\(\)\.encode\(ownerKey\(owner\)\)/);
  assert.match(vault, /patchEncryptedProfile/);
  assert.match(hook, /loadEncryptedProfile\(ownerId\)/);
  assert.match(hook, /const PROFILE_CACHE_FRESH = Infinity/);
  assert.doesNotMatch(hook, /getPayload\("\/api\/user\/political-opinions-consent"\)/);
  const authClient = read("hooks/use-auth.tsx");
  assert.match(authClient, /refetchOnWindowFocus: "always"/);
  assert.match(authClient, /isSessionVerified/);
  assert.match(authClient, /verifiedPoliticalConsent/);
  assert.doesNotMatch(hook, /refetchOnWindowFocus: "always"/);
  for (const section of ["government","representatives","candidates","opinions"]) {
    assert.ok(hook.includes("patchEncryptedProfile(ownerId, { " + section + ": result })"));
    assert.ok(hook.includes('["profilePolitical", ownerId, politicalEpoch, "' + section + '"]'));
  }
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
