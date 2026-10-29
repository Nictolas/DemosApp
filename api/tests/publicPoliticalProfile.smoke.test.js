'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const route = read('api/routes/users/public-profile.js');
const usersIndex = read('api/routes/users/index.js');
const hook = read('client/src/pages/Profilo/hooks/useProfileData.ts');
const profileInfo = read('client/src/pages/Profilo/components/ProfileInfo.tsx');
const profilePage = read('client/src/pages/Profilo/index.tsx');
const representatives = read('client/src/components/ProfileRepresentatives.tsx');
const candidates = read('client/src/components/ProfileCandidates.tsx');

test('public candidate/politician profile has dedicated auth route, no-store and not the Admin alias', () => {
  assert.match(route, /router\.get\('\/:userId\/public-profile', \(_req, res, next\) =>/);
  assert.match(route, /\}, verifyToken, async \(req, res\) =>/);
  assert.ok(route.includes("res.set('Cache-Control', 'private, no-store, max-age=0')"));
  assert.ok(route.includes('getAccountSubject(pool, userId)'));
  assert.ok(route.includes('isPolitician') && route.includes('isCandidate'));
  assert.ok(route.includes('Profilo pubblico non disponibile'));
  assert.ok(usersIndex.indexOf("router.use('/', publicProfileRoutes)") <
    usersIndex.indexOf("router.use('/', searchRoutes)"));
});

test('public projection omits private demographics and reads ministry votes only under consent', () => {
  for (const field of [
    'email', 'data_nascita', 'genere', 'cittadinanza',
    'paese_residenza', 'regione_residenza', 'provincia_residenza',
    'comune_residenza', 'telefono'
  ]) {
    assert.doesNotMatch(route, new RegExp('\\b' + field + '\\b'), field);
  }
  assert.ok(route.includes('loadSelectionDetails(rawUser, REPRESENTATIVE_FIELDS)'));
  assert.ok(route.includes('loadSelectionDetails(rawUser, CANDIDATE_FIELDS)'));
  assert.ok(route.includes('loadIdealGovernment(userId)'));
  assert.ok(route.includes('getPoliticalConsentState(pool, userId)'));
  assert.ok(route.includes('WHERE v.userid::text = $1::text'));
  assert.ok(route.includes('governoIdeale: finalConsent.granted ? governoIdeale : {}'));
  assert.ok(route.includes('rappresentanti: finalConsent.granted ? rappresentanti : {}'));
  assert.ok(route.includes('candidati: finalConsent.granted ? candidati : {}'));
  assert.ok(route.includes('user[field] = null;'));
});

test('other-person profile uses the dedicated public endpoint without privileged account reads', () => {
  const publicStart = hook.indexOf('async function loadOtherProfile(');
  const publicEnd = hook.indexOf('export const useProfileData', publicStart);
  assert.ok(publicStart >= 0 && publicEnd > publicStart);
  const publicLoad = hook.slice(publicStart, publicEnd);
  assert.match(publicLoad, /\/public-profile/);
  assert.match(publicLoad, /encodeURIComponent\(targetUserId\)/);
  assert.doesNotMatch(publicLoad, /\/api\/governo\/ideale|\/api\/rappresentanti|\/api\/candidati\/selezioni/);
  for (const part of ['payload.public?.rappresentanti','payload.public?.candidati','payload.public?.governoIdeale']) {
    assert.ok(publicLoad.includes(part), part);
  }
});

test('own political choices and target opinions are separately loaded and normalized', () => {
  const ownStart = hook.indexOf('async function loadOwnProfile(');
  const publicStart = hook.indexOf('async function loadOtherProfile(', ownStart);
  assert.ok(ownStart >= 0 && publicStart > ownStart);
  const own = hook.slice(ownStart, publicStart);
  for (const endpoint of ['/api/users/me','/api/governo/ideale','/api/rappresentanti','/api/candidati/selezioni']) {
    assert.ok(own.includes(endpoint), endpoint);
  }
  const publicLoad = hook.slice(publicStart, hook.indexOf('export const useProfileData', publicStart));
  assert.ok(publicLoad.includes('/opinioni'));
  assert.ok(publicLoad.includes('Array.isArray(opinionData?.opinioni)'));
  assert.ok(publicLoad.includes('normalizeOpinionValue(item.userAnswer)'));
  assert.match(hook, /ownProfile \? loadOwnProfile\(signal\) : loadOtherProfile\(targetId!, signal\)/);
});

test('public-profile UI hides edit controls and private demographic blocks', () => {
  assert.ok(profilePage.includes('canEditSelections={isViewingOwnProfile}'));
  assert.ok(profilePage.includes('isOwnProfile={isViewingOwnProfile}'));
  for (const component of [representatives, candidates]) {
    assert.ok(component.includes('{canEditSelections && ('));
  }
  assert.match(profileInfo, /\{isOwnProfile && \(\s*<details/);
});

test('profile client aborts stale requests and avoids logging political choices', () => {
  assert.match(hook, /queryFn: \(\{ signal \}\)/);
  assert.match(hook, /getProfilePayload\(path: string, signal: AbortSignal\)/);
  assert.match(hook, /const profileKey = \["profileSnapshot", ownerId \?\? null, targetId \?\? null\]/);
  assert.doesNotMatch(hook, /console\.(?:log|error|warn)\(/);
  assert.doesNotMatch(representatives, /console\.log\(/);
  assert.doesNotMatch(candidates, /console\.log\(/);
});
