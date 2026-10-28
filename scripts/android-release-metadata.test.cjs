'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { releaseMetadata } = require('./android-release-metadata.cjs');

const gradle = (code, name) => `android {\n defaultConfig {\n versionCode ${code}\n versionName "${name}"\n }\n}`;
const built = (code, name) => ({
  applicationId: 'community.demos', variantName: 'debug',
  elements: [{ versionCode: code, versionName: name }],
});

test('a new Gradle version labels its compiled candidate without updating CI literals', () => {
  assert.equal(releaseMetadata(gradle(12, '1.0.10'), built(12, '1.0.10')).artifactName,
    'demos-android-1.0.10-v12-UNSIGNED-aab');
  assert.equal(releaseMetadata(gradle(13, '1.0.11'), built(13, '1.0.11')).artifactName,
    'demos-android-1.0.11-v13-UNSIGNED-aab');
});

test('stale compiled output or a different package cannot be labelled as the candidate', () => {
  assert.throws(() => releaseMetadata(gradle(12, '1.0.10'), built(11, '1.0.9')), /Compiled versionCode/);
  assert.throws(() => releaseMetadata(gradle(12, '1.0.10'), built(12, '1.0.9')), /Compiled versionName/);
  assert.throws(() => releaseMetadata(gradle(12, '1.0.10'), { ...built(12, '1.0.10'), applicationId: 'other.app' }), /applicationId/);
});

test('ambiguous or unsafe identities fail closed before writing workflow output', () => {
  assert.throws(() => releaseMetadata(gradle(12, '1.0.10') + '\nversionCode 13', built(12, '1.0.10')), /one literal versionCode/);
  assert.throws(() => releaseMetadata(gradle(12, '1.0.10\nartifact_name=other'), built(12, '1.0.10')), /versionName/);
  assert.throws(() => releaseMetadata(gradle(12, '1.0.10'), { ...built(12, '1.0.10'), elements: [] }), /one compiled APK/);
});
