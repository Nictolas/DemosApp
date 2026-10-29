import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
const hook = read('pages/Profilo/hooks/useProfileData.ts');
const page = read('pages/Profilo/index.tsx');
const info = read('pages/Profilo/components/ProfileInfo.tsx');
const reps = read('components/ProfileRepresentatives.tsx');
const candidates = read('components/ProfileCandidates.tsx');
const client = read('lib/queryClient.ts');

function segment(start, end) {
  const a = hook.indexOf(start);
  const b = hook.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'Profile hook boundaries missing: ' + start);
  return hook.slice(a, b);
}

test('external profile uses only the public API and target identity', () => {
  const publicBlock = segment('async function loadOtherProfile(', 'export const useProfileData');
  assert.match(publicBlock, /\`\/api\/users\/\$\{encodeURIComponent\(targetUserId\)\}\/public-profile\`/);
  assert.match(publicBlock, /payload\.public\?\.governoIdeale/);
  assert.match(publicBlock, /payload\.public\?\.rappresentanti/);
  assert.match(publicBlock, /payload\.public\?\.candidati/);
  assert.doesNotMatch(publicBlock, /\/api\/governo\/ideale|\/api\/rappresentanti|\/api\/candidati\/selezioni/);
  assert.doesNotMatch(publicBlock, /\/api\/users\/\$\{targetUserId\}\`/);
});

test('own-only profile reads never populate the view of another user', () => {
  const ownBlock = segment('async function loadOwnProfile(', 'async function loadOtherProfile(');
  for (const endpoint of ['/api/users/me', '/api/governo/ideale', '/api/rappresentanti', '/api/candidati/selezioni']) {
    assert.ok(ownBlock.includes(endpoint), endpoint);
  }
  assert.match(hook, /ownProfile \? loadOwnProfile\(signal\) : loadOtherProfile\(targetId!, signal\)/);
  assert.match(hook, /const profileKey = \["profileSnapshot", ownerId \?\? null, targetId \?\? null\]/);
});

test('profile data requests are cancelled when no longer relevant', () => {
  assert.match(hook, /queryFn: \(\{ signal \}\)/);
  assert.match(hook, /getProfilePayload\(path: string, signal: AbortSignal\)/);
  assert.match(client, /externalSignal\?\.addEventListener\(['"]abort['"]/);
  assert.match(client, /externalSignal\?\.removeEventListener\(['"]abort['"]/);
  assert.doesNotMatch(hook, /localStorage\.(?:getItem|setItem)/);
});

test('public profiles cannot display private demographics or selection edit buttons', () => {
  assert.match(page, /isOwnProfile=\{isViewingOwnProfile\}/);
  assert.match(page, /canEditSelections=\{isViewingOwnProfile\}/);
  assert.match(info, /\{isOwnProfile && \(\s*<details/);
  assert.match(info, /canEdit && !isEditing/);
  for (const component of [reps, candidates]) {
    assert.match(component, /\{canEditSelections && \(/);
    assert.doesNotMatch(component, /console\.log\(/);
  }
});

test('political responses and public profile payloads never get logged on client', () => {
  assert.doesNotMatch(hook, /console\.(?:log|warn|error)\(/);
  assert.doesNotMatch(reps, /console\.log\(/);
  assert.doesNotMatch(candidates, /console\.log\(/);
  assert.doesNotMatch(client, /Text preview|Parsed data|JSON\.stringify\(data, null, 2\)/);
});

test('target opinion values use the target endpoint and conservative interpretation', () => {
  const publicBlock = segment('async function loadOtherProfile(', 'export const useProfileData');
  assert.match(publicBlock, /\/opinioni/);
  assert.match(publicBlock, /opinionData\?\.opinioni/);
  assert.match(publicBlock, /normalizeOpinionValue\(item\.userAnswer\)/);
  assert.match(publicBlock, /if \(!normalized\) continue/);
});
