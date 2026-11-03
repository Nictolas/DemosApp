'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isObservationEnabled,
  validTokenShape,
  observeAppCheckHeader,
} = require('../services/firebaseAppCheckObservation');

const validEnv = {
  FIREBASE_APP_CHECK_OBSERVE_ENABLED: 'true',
  FIREBASE_APP_CHECK_COST_GUARD_APPROVED: 'true',
  FIREBASE_PROJECT_ID: 'demos-finale',
  FIREBASE_APP_CHECK_ANDROID_APP_ID: '1:848085963511:android:abcdef012345',
};
const token = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhcHAifQ.signature123';

test('observation remains OFF unless ALL explicit gates match', async () => {
  for (const env of [
    {}, { ...validEnv, FIREBASE_APP_CHECK_OBSERVE_ENABLED: 'false' },
    { ...validEnv, FIREBASE_APP_CHECK_COST_GUARD_APPROVED: 'false' },
    { ...validEnv, FIREBASE_PROJECT_ID: 'demos-oauth-e2e' },
  ]) {
    assert.equal(isObservationEnabled(env), false);
    let calls = 0;
    const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
      env, verifyToken: async () => { calls++; throw Error('must not run'); },
    });
    assert.deepEqual(result, { status: 'disabled' });
    assert.equal(calls, 0);
  }
});

test('unconfigured Android App ID prevents any SDK verification', async () => {
  let calls = 0;
  const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
    env: { ...validEnv, FIREBASE_APP_CHECK_ANDROID_APP_ID: 'community.demos' },
    verifyToken: async () => { calls++; },
  });
  assert.deepEqual(result, { status: 'unconfigured' });
  assert.equal(calls, 0);
});

test('missing and malformed headers never hit the SDK', async () => {
  let calls = 0;
  const verifyToken = async () => { calls++; throw Error('must not run'); };
  assert.deepEqual(await observeAppCheckHeader({}, { env: validEnv, verifyToken }), { status: 'missing' });
  assert.deepEqual(await observeAppCheckHeader({ 'x-firebase-appcheck': 'not-a-jwt' }, { env: validEnv, verifyToken }), { status: 'malformed' });
  assert.deepEqual(await observeAppCheckHeader({ 'x-firebase-appcheck': 'x'.repeat(9000) }, { env: validEnv, verifyToken }), { status: 'malformed' });
  assert.equal(calls, 0);
  assert.equal(validTokenShape(token), true);
});

test('valid token for the explicitly selected app is classified, not enforced', async () => {
  let calls = 0;
  const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
    env: validEnv,
    verifyToken: async t => {
      calls++;
      assert.equal(t, token);
      return { appId: validEnv.FIREBASE_APP_CHECK_ANDROID_APP_ID };
    },
  });
  assert.deepEqual(result, { status: 'verified' });
  assert.equal(calls, 1);
});

test('token issued for another app is not trusted', async () => {
  const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
    env: validEnv, verifyToken: async () => ({ appId: '1:848085963511:web:abcdef012345' }),
  });
  assert.deepEqual(result, { status: 'different_app' });
});

test('bad signatures and verification errors expose no token or error details', async () => {
  const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
    env: validEnv, verifyToken: async () => { throw Error('sensitive-token-or-claims'); },
  });
  assert.deepEqual(result, { status: 'invalid' });
  assert.equal(JSON.stringify(result).includes('sensitive'), false);
});

test('ordinary verification is NOT replay protection', async () => {
  let calls = 0;
  const verifyToken = async () => {
    calls++;
    return { appId: validEnv.FIREBASE_APP_CHECK_ANDROID_APP_ID };
  };
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(
      await observeAppCheckHeader({ 'x-firebase-appcheck': token }, { env: validEnv, verifyToken }),
      { status: 'verified' }
    );
  }
  assert.equal(calls, 2);
});

test('the source is not mounted into routes or coupled to direct Play Integrity flags', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..', '..');
  const gradle = fs.readFileSync(path.join(root, 'client/android/app/build.gradle'), 'utf8');
  const java = fs.readFileSync(path.join(root, 'client/android/app/src/main/java/community/demos/NativeFirebaseAppCheckPlugin.java'), 'utf8');
  const ts = fs.readFileSync(path.join(root, 'client/src/lib/nativeFirebaseAppCheck.ts'), 'utf8');
  assert.match(gradle, /buildConfigField "boolean", "FIREBASE_APP_CHECK_ENABLED", "false"/);
  assert.match(java, /BuildConfig.FIREBASE_APP_CHECK_ENABLED/);
  assert.match(java, /installAppCheckProviderFactory\([\s\S]*false/);
  assert.match(java, /getAppCheckToken\(false\)/);
  assert.match(ts, /VITE_FIREBASE_APP_CHECK_ENABLED !== 'true'/);
  // Reject direct-Integrity calls in executable Java, not explanatory comments.
  const executableJava = java
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executableJava, /decodeIntegrityToken|requestHash|PLAY_INTEGRITY_PROJECT_NUMBER/);
});
