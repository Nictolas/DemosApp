const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('combined Android config preserves DEMOS hostname and native push presentation', () => {
  const config = read('client/capacitor.config.ts');
  assert.match(config, /hostname:\s*'demos\.community'/);
  assert.match(config, /androidScheme:\s*'https'/);
  assert.match(config, /PushNotifications:\s*\{/);
  assert.match(config, /presentationOptions:\s*\['alert',\s*'sound'\]/);
});

test('combined Android build preserves auth stack, minSdk 24 and push plugin wiring', () => {
  const variables = read('client/android/variables.gradle');
  const appGradle = read('client/android/app/build.gradle');
  const capacitorGradle = read('client/android/app/capacitor.build.gradle');
  const settings = read('client/android/capacitor.settings.gradle');
  const mainActivity = read('client/android/app/src/main/java/community/demos/MainActivity.java');

  assert.match(variables, /minSdkVersion\s*=\s*24/);
  assert.match(appGradle, /androidx\.credentials:credentials:/);
  assert.match(appGradle, /credentials-play-services-auth/);
  assert.match(appGradle, /com\.google\.android\.libraries\.identity\.googleid:googleid:/);
  assert.match(mainActivity, /NativeGoogleAuthPlugin/);
  assert.match(capacitorGradle, /capacitor-push-notifications/);
  assert.match(settings, /capacitor-push-notifications/);
});

test('combined logout preserves push invalidation and Google Credential Manager cleanup', () => {
  const auth = read('client/src/hooks/use-auth.tsx');
  const tokenRead = auth.indexOf('getStoredNativePushToken()');
  const serverDelete = auth.indexOf('method: "DELETE"', tokenRead);
  const unregister = auth.indexOf('await unregisterNativePush()', tokenRead);
  const clearSession = auth.indexOf('clearSessionTokens()', tokenRead);
  const googleCleanup = auth.indexOf('await clearNativeGoogleCredentialState()', clearSession);

  assert.ok(tokenRead >= 0);
  assert.ok(serverDelete > tokenRead);
  assert.ok(unregister > serverDelete);
  assert.ok(clearSession > unregister);
  assert.ok(googleCleanup > clearSession);
});

test('combined package keeps native push dependency and guarded Firebase build helper', () => {
  const packageJson = read('client/package.json');
  const helper = read('client/scripts/build-android-native-push.mjs');

  assert.match(packageJson, /@capacitor\/push-notifications/);
  assert.match(packageJson, /"android:sync:push"/);
  assert.match(helper, /EXPECTED_PROJECT_ID = 'demos-finale'/);
  assert.match(helper, /EXPECTED_PACKAGE_NAME = 'community\.demos'/);
  assert.match(helper, /VITE_ANDROID_NATIVE_PUSH_ENABLED:\s*'true'/);
});
