'use strict';
// DEMOS12: account profile editing must not expose fields to browser logs.
// Synthetic static contract only: no account data, browser, network or database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../client/src/components/profile/EditProfileForm.tsx'),
  'utf8'
);

test('profile editing does not log personal or geographic data to the browser console', () => {
  assert.doesNotMatch(source, /console\s*\.(log|debug|info|warn|error|dir|table)\s*\(/);
  assert.doesNotMatch(source, /DEBUG EditProfileForm/);
});

test('removing debug logs preserves user self-edit and activist fields', () => {
  assert.match(source, /useProfileForm\(userData, onProfileUpdated, isAdmin\)/);
  assert.match(source, /const shouldShowActivismSection =/);
  assert.match(source, /<ActivismTypesSection/);
  assert.match(source, /onSubmit=\{handleSubmit\}/);
  assert.match(source, /onProfileUpdated/);
});
