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
  assert.doesNotMatch(hook, /localStorage|sessionStorage|indexedDB/i);
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
