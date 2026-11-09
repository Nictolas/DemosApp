'use strict';
// DEMOS12: do not expose profile fields in browser or backend logs.
// Synthetic source contract only: no user data, network or database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const form = read('client/src/components/profile/EditProfileForm.tsx');
const hook = read('client/src/components/profile/useProfileForm.ts');
const profileRoute = read('api/routes/users/profile.js');
const ownProfilePut = profileRoute.split("router.put('/me'")[1]?.split("router.put('/:userId/seleziona-rappresentante'")[0];

test('profile editing does not log personal or geographic data to the browser console', () => {
  assert.doesNotMatch(form, /console\s*\.(log|debug|info|warn|error|dir|table)\s*\(/);
  assert.doesNotMatch(form, /DEBUG EditProfileForm/);
  assert.doesNotMatch(hook, /DEBUG useProfileForm/);
  assert.doesNotMatch(hook, /console\s*\.(?:log|warn|error)\s*\([^;\n]*(?:dataToSend|formData|currentInitialData|activismError|activismData\.error|,\s*error)/);
  assert.match(hook, /PROFILE_ACTIVISM_TYPES_UPDATE_FAILED/);
  assert.match(hook, /PROFILE_UPDATE_FAILED/);
});

test('backend self-profile update does not log email, changed values or raw exceptions', () => {
  assert.ok(ownProfilePut, 'self-profile PUT must remain available');
  assert.doesNotMatch(ownProfilePut, /console\.[^\n]*(?:updatedUser\.email|updateData\[key\]|filteredData\[key\]|,\s*error)/);
  assert.match(ownProfilePut, /console\.error\('PROFILE_UPDATE_FAILED'\)/);
  assert.match(ownProfilePut, /allowedFields/);
  assert.match(ownProfilePut, /UPDATE users SET/);
});

test('removing debug logs preserves user self-edit and activist fields', () => {
  assert.match(form, /useProfileForm\(userData, onProfileUpdated, isAdmin\)/);
  assert.match(form, /const shouldShowActivismSection =/);
  assert.match(form, /<ActivismTypesSection/);
  assert.match(form, /onSubmit=\{handleSubmit\}/);
  assert.match(hook, /apiRequest\("PUT", endpoint, dataToSend\)/);
  assert.match(hook, /apiRequest\("PUT", activismEndpoint/);
  assert.match(form, /onProfileUpdated/);
});
