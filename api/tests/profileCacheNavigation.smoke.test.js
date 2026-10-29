'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('profile replaces Settings as the bottom navigation destination', () => {
  const nav = read('client/src/lib/nav-items.ts');
  const profile = read('client/src/pages/Profilo/index.tsx');
  assert.match(nav, /path:\s*"\/profilo",[\s\S]*?label:\s*"Profilo"/);
  assert.doesNotMatch(nav, /path:\s*"\/impostazioni"/);
  assert.match(profile, /<Link href="\/impostazioni"/);
});

test('profile cache is private, account-scoped and does not persist political responses to localStorage', () => {
  const hook = read('client/src/pages/Profilo/hooks/useProfileData.ts');
  const profile = read('client/src/pages/Profilo/index.tsx');
  assert.match(hook, /useQuery<ProfileSnapshot>/);
  assert.match(hook, /queryKey:\s*\["profileSnapshot", ownerId \?\? null, targetId \?\? null\]/);
  assert.match(hook, /staleTime:\s*ownProfile \?/);
  assert.match(hook, /gcTime:\s*ownProfile \?/);
  assert.doesNotMatch(hook, /(?:localStorage|sessionStorage)\.(?:getItem|setItem)|indexedDB\.open/i);
  assert.doesNotMatch(profile, /localStorage\.getItem|localStorage\.setItem/);
});

test('foreign public profiles do not reuse the visitor selections or privileged user routes', () => {
  const hook = read('client/src/pages/Profilo/hooks/useProfileData.ts');
  assert.match(hook, /\/public-profile/);
  assert.match(hook, /payload\.public\?\.governoIdeale/);
  assert.doesNotMatch(hook, /apiRequest\("GET", `\/api\/users\/\$\{userId\}`\)/);
  assert.match(hook, /gcTime:\s*ownProfile \?[^\n]+: 0/);
});

test('profile snapshot invalidated after API writes and auth logout clears memory cache', () => {
  const client = read('client/src/lib/queryClient.ts');
  const auth = read('client/src/hooks/use-auth.tsx');
  assert.match(client, /queryClient\.invalidateQueries\(\{ queryKey: \["profileSnapshot"\] \}\)/);
  assert.match(auth, /queryClient\.clear\(\)/);
});

test('the profile form unpacks the response envelope and does not leak user data to console', () => {
  const form = read('client/src/components/profile/useProfileForm.ts');
  const editor = read('client/src/components/profile/EditProfileForm.tsx');
  assert.match(form, /const data = response\.data;/);
  assert.match(form, /if \(!response\.ok \|\| data\?\.success === false\)/);
  assert.doesNotMatch(editor, /DEBUG EditProfileForm/);
});

test('a third-party profile hides private demographic/contact cards and selection actions', () => {
  const page = read('client/src/pages/Profilo/index.tsx');
  const info = read('client/src/pages/Profilo/components/ProfileInfo.tsx');
  const reps = read('client/src/components/ProfileRepresentatives.tsx');
  const candidates = read('client/src/components/ProfileCandidates.tsx');
  assert.match(page, /isOwnProfile=\{isViewingOwnProfile\}/);
  assert.match(page, /canEditSelections=\{isViewingOwnProfile\}/g);
  assert.match(info, /\{isOwnProfile && \(\s*<details className=/);
  assert.match(info, /\{isOwnProfile && \(\s*<details/);
  assert.match(reps, /\{canEditSelections && \(/);
  assert.match(candidates, /\{canEditSelections && \(/);
});

test('public opinions are mapped from the public endpoint and compact values are normalized', () => {
  const hook = read('client/src/pages/Profilo/hooks/useProfileData.ts');
  assert.match(hook, /Array\.isArray\(opinionData\?\.opinioni\)/);
  assert.match(hook, /normalizeOpinionValue\(item\.userAnswer\)/);
  assert.match(hook, /answers\[item\.id\] = normalized/);
  assert.match(hook, /value === "f".*?"Favorevole"/);
  assert.match(hook, /value === "c".*?"Contrario"/);
  assert.match(hook, /value === "i".*?"Indeciso"/);
});

test('consent revocation resets, rather than retaining, cached political selections', () => {
  const client = read('client/src/lib/queryClient.ts');
  assert.match(client, /apiPath === "user\/political-opinions-consent\/revoke"/);
  assert.match(client, /queryClient\.resetQueries\(\{ queryKey: \["profileSnapshot"\] \}\)/);
});

test('successful profile edits avoid a second redundant full GET', () => {
  const page = read('client/src/pages/Profilo/index.tsx');
  const saveHandler = page.match(/const handleSaveProfile = \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(saveHandler);
  assert.doesNotMatch(saveHandler[0], /fetchAllProfileData|apiRequest/);
});

test('mobile profile uses a small avatar and expandable sections instead of tall demographic tiles', () => {
  const profile = read('client/src/pages/Profilo/index.tsx');
  const info = read('client/src/pages/Profilo/components/ProfileInfo.tsx');
  const government = read('client/src/pages/Profilo/components/ProfileGovernoIdeale.tsx');
  assert.match(info, /h-\[76px\] w-\[76px\]/);
  assert.match(info, /Dati personali completi/);
  assert.match(info, /<details className="group mt-3/);
  assert.doesNotMatch(info, /I tuoi dati personali e informazioni di contatto/);
  assert.match(profile, /<details className="group rounded-xl/);
  assert.match(profile, /showHeading=\{false\}/g);
  assert.match(profile, /Opinioni politiche · /);
  assert.match(government, /<details className="group/);
  assert.match(government, /Scegli ministri/);
});

test('the compact profile does not accidentally expose own-only demographic values to other visitors', () => {
  const info = read('client/src/pages/Profilo/components/ProfileInfo.tsx');
  const ownOnly = info.indexOf('{isOwnProfile && (');
  const fullDetails = info.indexOf('{detailRows.map(', ownOnly);
  assert.ok(ownOnly >= 0 && fullDetails > ownOnly);
  assert.match(info, /\{isOwnProfile && \(\s*<details/);
  assert.match(info, /canEdit && !isEditing/);
});
