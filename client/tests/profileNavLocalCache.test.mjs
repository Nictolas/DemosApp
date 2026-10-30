import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";


const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const nav = read("lib/nav-items.ts");
const profile = read("pages/Profilo/index.tsx");
const hook = read("pages/Profilo/hooks/useProfileData.ts");
const government = read("pages/Profilo/components/ProfileGovernoIdeale.tsx");
const profileInfo = read("pages/Profilo/components/ProfileInfo.tsx");
const profileRepresentatives = read("components/ProfileRepresentatives.tsx");
const profileCandidates = read("components/ProfileCandidates.tsx");

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

test("desktop header uses existing demographic summary before any avatar GET", () => {
  const header = read("components/DesktopAppHeader.tsx");
  assert.match(header, /readProfileSummary\(user\.id\)/);
  assert.match(header, /if \(saved\) return parseAvatarConfig\(saved\.user\.avatar_config\)/);
  assert.match(header, /storeProfileSummary\(user\.id, userData\)/);
  assert.match(header, /staleTime: Infinity/);
  assert.match(header, /gcTime: Infinity/);
});

test("the first bottom nav item is Profile, with no Favorites or Settings tab", () => {
  const items = nav.slice(nav.indexOf("export const MAIN_NAV_ITEMS"));
  assert.match(items, /\[\s*\{\s*path: "\/profilo",\s*label: "Profilo"/);
  assert.doesNotMatch(items, /path: "\/preferiti"/);
  assert.doesNotMatch(items, /path: "\/impostazioni"/);
  assert.doesNotMatch(profile, /<Link href="\/preferiti"/);
  assert.match(profile, /href="\/impostazioni"/);
  assert.doesNotMatch(profile, /Collegamenti del profilo/);
});

test("owner Profile keeps Demos logo left and the icon-only Settings shortcut on the right", () => {
  const settings = profile.indexOf('data-testid="profilo-impostazioni-icon"');
  const logo = profile.indexOf('data-testid="profilo-logo-gestisci"');
  const heading = profile.indexOf('Profilo Cittadino');
  assert.ok(logo > 0 && logo < heading && heading < settings,
    "Demos logo must precede the title; Settings must be the rightmost header item");
  assert.match(profile, /<div className="min-w-0 flex-1">/);
  assert.match(profile, /aria-label="Apri impostazioni"/);
  assert.match(profile, /title="Impostazioni"/);
  assert.match(profile, /<Settings aria-hidden="true" className="h-5 w-5" \/>/);
  assert.match(profile, /h-11 w-11 shrink-0 items-center justify-center rounded-full/);
  assert.match(profile, /\{isViewingOwnProfile && \(\s*<Link\s+href="\/impostazioni"/);
  assert.doesNotMatch(profile, /<\/Settings>\s*Impostazioni/);
  assert.doesNotMatch(profile, /<Star\b/);
});

test("Profile sync is icon-only next to Settings and never fetches automatically", () => {
  const logo = profile.indexOf('data-testid="profilo-logo-gestisci"');
  const heading = profile.indexOf('Profilo Cittadino');
  const sync = profile.indexOf('data-testid="profilo-sincronizza-icon"');
  const settings = profile.indexOf('data-testid="profilo-impostazioni-icon"');
  const headerEnd = profile.indexOf('<div className="space-y-4">');
  assert.ok(logo > 0 && logo < heading && heading < sync && sync < settings && settings < headerEnd,
    "Sync icon belongs right before Settings, while the logo remains on the left");
  assert.match(profile, /aria-label="Sincronizza manualmente il profilo e le sue sezioni"/);
  assert.match(profile, /title="Sincronizza profilo"/);
  assert.match(profile, /<RefreshCcw aria-hidden="true" className="h-5 w-5" \/>/);
  assert.match(profile, /onClick=\{\(\) => void fetchAllProfileData\(\)\}/);
  assert.equal(profile.match(/onClick=\{\(\) => void fetchAllProfileData\(\)\}/g)?.length, 1,
    "Manual sync must have exactly one click trigger");
  assert.match(profile, /data-testid="profilo-sincronizza-icon"[\s\S]*?h-11 w-11 shrink-0/);
  assert.doesNotMatch(profile, /<RefreshCcw[^>]*\/>\s*Sincronizza profilo/);
});

test("all selection actions remain visible in open profile panels", () => {
  assert.match(profile, /<Link href="\/rappresentanti"/);
  assert.match(profile, /Scegli Rappresentanti/);
  assert.match(profile, /<Link href="\/candidati"/);
  assert.match(profile, /Scegli Candidati/);
  assert.match(government, /<Link href="\/governo"/);
  assert.match(government, /Scegli ministri/);
});

test("cached candidate and representative names and avatars render without a deferred effect or network request", () => {
  for (const [source, label, details] of [
    [profileRepresentatives, "rappresentanti", "rappresentantiDetails"],
    [profileCandidates, "candidati", "candidatiDetails"],
  ]) {
    assert.match(source, /import \{ useMemo \} from "react"/, label + " must calculate in render");
    assert.match(source, /useMemo\(\(\) => \{/, label + " must be computed synchronously");
    assert.ok(source.includes("}, [userInfo, " + details + "]);"), label + " must follow cached inputs");
    assert.match(source, /if \(!userInfo\) return \{/);
    assert.doesNotMatch(source, /useEffect|useState|setRepresentativeNames|setCandidateNames|fetchRepresentativeNames|fetchCandidateNames/);
    assert.doesNotMatch(source, /\bfetch\(|\bapiRequest\b|axios\.|useQuery\(/, "no additional network calls");
    assert.match(source, /<CustomAvatar config=\{/, "avatar rendering remains");
  }
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
  assert.ok(read("hooks/useAuthLogin.ts").includes('window.location.href = "/profilo"'));
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
    assert.ok(hook.includes("patchEncryptedProfile(ownerId, { " + section + ": result }, { " + section + ": revision })"));
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

test("profile shows the concise personal summary and edit action without duplicated detail rows or extra reads", () => {
  for (const content of ["birthYear", "userInfo.cittadinanza", "locationSummary", "Modifica profilo", "onEditClick();"]) {
    assert.ok(profileInfo.includes(content), "missing summary or edit control: " + content);
  }
  assert.match(profile, /Profilo Cittadino/);
  assert.doesNotMatch(profile, /Profilo Utente/);
  assert.doesNotMatch(profileInfo, /Il mio profilo/);
  assert.match(profileInfo, /\(canShowFullName \|\| !isOwnProfile\) && \(/);
  for (const obsolete of ["Dati personali completi", "detailRows", "onPersonalDetailsToggle"]) {
    assert.ok(!profileInfo.includes(obsolete), "obsolete full-detail UI: " + obsolete);
  }
  assert.ok(!profile.includes('onPersonalDetailsToggle'));
  assert.ok(!profile.includes('setPanel("personal"'));
  assert.ok(!hook.includes("panels.personal"));
  assert.ok(!hook.includes("personal: false"));
  assert.ok(hook.includes("const needFull = panels.edit ||"));
});

test("own profile shows a pencil next to demographic summary instead of a full-width edit button", () => {
  const summary = profileInfo.indexOf('flex min-w-0 items-center gap-1');
  const birthYear = profileInfo.indexOf('birthYear !== "Non specificato"', summary);
  const pencil = profileInfo.indexOf('data-testid="profilo-modifica-icon"', summary);
  const location = profileInfo.indexOf('locationSummary &&', summary);
  assert.ok(summary >= 0 && birthYear > summary && pencil > birthYear && location > pencil,
    "The edit control must sit alongside birth year and citizenship before location");
  assert.match(profileInfo, /\{canEdit && !isEditing && \(\s*<button/);
  assert.match(profileInfo, /aria-label="Modifica profilo"/);
  assert.match(profileInfo, /title="Modifica profilo"/);
  assert.match(profileInfo, /onClick=\{\(\) => setShowEditConfirmation\(true\)\}/);
  assert.match(profileInfo, /h-11 w-11 shrink-0 items-center justify-center/);
  assert.match(profileInfo, /<Edit aria-hidden="true" className="h-4 w-4" \/>/);
  assert.doesNotMatch(profileInfo, /mt-3 h-9 w-full gap-2/);
});

test("pencil requires a local Annulla or Procedi confirmation before editing", () => {
  assert.match(profileInfo, /const \[showEditConfirmation, setShowEditConfirmation\] = useState\(false\)/);
  assert.match(profileInfo, /<Dialog open=\{showEditConfirmation\} onOpenChange=\{setShowEditConfirmation\}>/);
  assert.match(profileInfo, /<DialogTitle>Vuoi modificare il profilo\?<\/DialogTitle>/);
  assert.match(profileInfo, /onClick=\{\(\) => setShowEditConfirmation\(false\)\}>Annulla<\/Button>/);
  assert.match(profileInfo, /setShowEditConfirmation\(false\);\s*onEditClick\(\);/);
  assert.match(profileInfo, />\s*Procedi\s*<\/Button>/);
  assert.doesNotMatch(profileInfo, /onClick=\{onEditClick\}/,
    "The pencil must not open editing directly without confirmation");
  assert.match(profileInfo, /<Dialog open=\{showAvatarDialog\} onOpenChange=\{setShowAvatarDialog\}>/,
    "The pre-existing avatar confirmation must remain unchanged");
});

test("authenticated app startup consistently opens Profile and not Favorites", () => {
  const wrapper = read("components/AppWrapper.tsx");
  const landing = read("pages/LandingPage.tsx");
  const auth = read("pages/auth-page.tsx");
  assert.ok(wrapper.includes("if (!isAuthLoading && user && location === '/')"));
  assert.ok(wrapper.includes("setLocation('/profilo');"));
  assert.ok(!wrapper.includes("setLocation('/preferiti');"));
  assert.ok(landing.includes('return <Redirect to="/profilo" />;'));
  assert.ok(auth.includes('return <Redirect to="/profilo" />;'));
  assert.ok(!landing.includes('return <Redirect to="/preferiti" />;'));
  assert.ok(!auth.includes('return <Redirect to="/preferiti" />;'));
  assert.ok(read("hooks/useAuthLogin.ts").includes('window.location.href = "/profilo"'));
  // The old Favorites route survives for other flows but not as a Profile shortcut.
  assert.ok(!profile.includes('<Link href="/preferiti"'));
  assert.ok(wrapper.includes('return <Redirect to="/preferiti" />;'));
});

test("startup shows no timed React splash and Android has no artificial launch delay", () => {
  const wrapper = read("components/AppWrapper.tsx");
  const stylesheet = read("index.css");
  const policy = read("pages/CookiePolicy.tsx");
  const capacitor = readFileSync(new URL("../capacitor.config.ts", import.meta.url), "utf8");

  for (const stale of ["SplashScreen", "showSplash", "isAppReady", "splash_shown", "app_loaded", "setTimeout("]) {
    assert.ok(!wrapper.includes(stale), "stale splash startup code: " + stale);
  }
  assert.ok(wrapper.includes("setLocation('/profilo');"), "authenticated startup still opens Profile");
  assert.ok(wrapper.includes("if (isAdminOnlyPath(location))"), "admin route guard remains active");
  assert.ok(wrapper.includes("if (isAuthLoading)"), "auth loading guard remains active");
  assert.ok(!stylesheet.includes(".splash-screen"), "dead splash overlay CSS must be removed");
  assert.ok(!stylesheet.includes("@keyframes splash"), "dead splash animations must be removed");
  assert.ok(!policy.includes(">app_loaded<"), "obsolete splash storage declaration must be removed");
  assert.ok(capacitor.includes("launchShowDuration: 0"), "no fixed native launch duration");
  assert.ok(capacitor.includes("launchAutoHide: true"), "native splash must not remain indefinitely");
  assert.ok(capacitor.includes("launchFadeOutDuration: 0"), "no additional native fade delay");
  assert.equal(existsSync(new URL("../src/components/SplashScreen.tsx", import.meta.url)), false, "the obsolete component must be deleted");
});
