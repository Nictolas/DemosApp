import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const hook = read('pages/Profilo/hooks/useProfileData.ts');
const page = read('pages/Profilo/index.tsx');
const info = read('pages/Profilo/components/ProfileInfo.tsx');
const reps = read('components/ProfileRepresentatives.tsx');
const candidates = read('components/ProfileCandidates.tsx');

test('external profile uses public projection, never the private Admin user lookup', () => {
  assert.match(hook, /isOwnProfile \? '\/api\/users\/me' : '\/api\/users\/' \+ targetUserId \+ '\/public-profile'/);
  assert.doesNotMatch(hook, /apiRequest\(['"]GET['"],\s*['"]\/api\/users\/['"]\s*\+\s*targetUserId\s*\)/);
  assert.match(hook, /payload\.public\?\.governoIdeale \|\| \{\}/);
  assert.match(hook, /payload\.public\?\.rappresentanti \|\| \{\}/);
  assert.match(hook, /payload\.public\?\.candidati \|\| \{\}/);
});

test('the viewer own government/representative/candidate queries are gated to own profile', () => {
  const start = hook.indexOf('if (isOwnProfile) {\n        const requests =');
  const end = hook.indexOf('\n      if (!isCurrent()) return;', start);
  assert.ok(start > 0 && end > start);
  const block = hook.slice(start, end);
  for (const ownRoute of ['/api/governo/ideale', '/api/rappresentanti', '/api/candidati/selezioni']) {
    assert.ok(block.includes(ownRoute), ownRoute);
  }
  assert.match(hook, /'\/api\/users\/' \+ targetUserId \+ '\/opinioni'/);
  assert.match(hook, /normalizeOpinionValue\(item\.userAnswer\)/);
});

test('switching account/profile invalidates old requests and clears last rendered political selections', () => {
  assert.match(hook, /currentRequest\.current\?\.abort\(\)/);
  assert.match(hook, /new AbortController\(\)/);
  assert.match(hook, /requestVersion\.current === version/);
  assert.match(hook, /undefined, undefined, controller\.signal/);
  for (const statement of [
    'setUserInfo(null)', 'setUserOpinions({})', 'setGovernoIdeale({})',
    'setRappresentantiDetails({})', 'setCandidatiDetails({})'
  ]) assert.ok(hook.includes(statement), statement);
  assert.match(hook, /if \(!isCurrent\(\)\) return;\s*setUserInfo\(profile as UserInfo\)/);
});

test('public users cannot access selection edit buttons or own-profile demographic sections', () => {
  assert.match(page, /canEditSelections=\{isViewingOwnProfile\}/);
  assert.match(page, /isOwnProfile=\{isViewingOwnProfile\}/);
  for (const component of [reps, candidates]) {
    assert.match(component, /\{canEditSelections && \(/);
    assert.doesNotMatch(component, /console\.log\(/);
  }
  assert.match(info, /\{isOwnProfile && \(/);
  assert.match(info, /Informazioni pubbliche del profilo politico/);
  assert.match(info, /isOwnProfile && \(userInfo\.professione/);
});

test('profile client does not print fetched political preferences or public profile payloads', () => {
  assert.doesNotMatch(hook, /console\.(?:log|warn|error)\(/);
  assert.doesNotMatch(reps, /console\.log\(/);
  assert.doesNotMatch(candidates, /console\.log\(/);
});
