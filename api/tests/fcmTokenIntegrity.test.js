const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('web FCM token uses the explicitly configured Firebase service worker', () => {
  const hook = read('client/src/hooks/useFCM.ts');
  assert.match(hook, /firebase-messaging-sw\.js\?\$\{swParams\.toString\(\)\}/);
  assert.match(hook, /serviceWorkerRegistration:\s*registration/);
  assert.match(hook, /new URLSearchParams/);
  assert.doesNotMatch(hook, /setToken\(deviceId\)/);
  assert.doesNotMatch(hook, /`web_\$\{Date\.now\(\)\}/);
});

test('web FCM is fail-closed inside the native Capacitor app', () => {
  const hook = read('client/src/hooks/useFCM.ts');
  assert.match(hook, /import \{ Capacitor \} from '@capacitor\/core'/);
  assert.match(hook, /Capacitor\.isNativePlatform\(\)/);
  assert.match(hook, /if \(isNativeApp\(\)\) \{[\s\S]*setMessaging\(null\);[\s\S]*return;/);
  assert.match(hook, /FCM web disabilitato/);
});

test('FCM service worker has no fake project configuration and reads registered public config', () => {
  const sw = read('client/public/firebase-messaging-sw.js');
  assert.match(sw, /self\.location\.href/);
  assert.match(sw, /searchParams\.get\('projectId'\)/);
  assert.match(sw, /searchParams\.get\('messagingSenderId'\)/);
  assert.match(sw, /hasRequiredFirebaseConfig/);
  assert.doesNotMatch(sw, /your-project/);
  assert.doesNotMatch(sw, /000000000000/);
  assert.doesNotMatch(sw, /AIzaSyx+/);
});

test('backend rejects fake or malformed FCM tokens before token persistence', () => {
  const route = read('api/routes/fcm-tokens.js');
  assert.match(route, /token\.length > 100 && !token\.startsWith\('web_'\)/);
  const validation = route.indexOf('if (!isValidFcmToken(token))');
  const existingLookup = route.indexOf('const existingTokens = await getLegacyTokens(userId);', validation);
  const legacyWrite = route.indexOf("await updateLegacyTokens(userId, updatedTokens);", validation);
  assert.ok(validation >= 0);
  assert.ok(existingLookup > validation);
  assert.ok(legacyWrite > validation);
  assert.doesNotMatch(route, /Token: \$\{token\.substring/);
});

test('legacy cache service worker remains disabled instead of competing with FCM root scope', () => {
  const main = read('client/src/main.tsx');
  assert.doesNotMatch(main, /^\s*navigator\.serviceWorker\.register\('\/sw\.js'\)/m);
});

test('native Capacitor push path is wired separately from web FCM', () => {
  const packageJson = read('client/package.json');
  const nativeHook = read('client/src/hooks/useNativePush.ts');
  const unifiedHook = read('client/src/hooks/usePushNotifications.ts');
  const syncHook = read('client/src/hooks/useSyncFcmToken.ts');

  assert.match(packageJson, /@capacitor\/push-notifications/);
  assert.match(nativeHook, /PushNotifications\.requestPermissions\(\)/);
  assert.match(nativeHook, /PushNotifications\.register\(\)/);
  assert.match(nativeHook, /addListener\('registration'/);
  assert.match(nativeHook, /addListener\('pushNotificationReceived'/);
  assert.match(nativeHook, /addListener\('pushNotificationActionPerformed'/);
  assert.match(unifiedHook, /transport:\s*'native'/);
  assert.match(syncHook, /source:\s*transport === 'native' \? 'android-native' : 'web-mobile'/);
});

test('native Android channels and legacy tap fallbacks cover current backend payloads', () => {
  const nativeHook = read('client/src/hooks/useNativePush.ts');
  assert.match(nativeHook, /id:\s*'demos_notifications'/);
  assert.match(nativeHook, /id:\s*'avvistamenti_notifications'/);
  assert.match(nativeHook, /PushNotifications\.createChannel\(channel\)/);
  assert.match(nativeHook, /case 'demos_notification':[\s\S]*return '\/comunica'/);
  assert.match(nativeHook, /case 'avvistamento':[\s\S]*return '\/avvistamenti'/);
  assert.match(nativeHook, /case 'operational_alert':[\s\S]*return '\/notifiche'/);
  assert.match(nativeHook, /getFallbackNotificationTarget\(data\.type\)/);
});

test('logout invalidates stored native push token before clearing the session', () => {
  const auth = read('client/src/hooks/use-auth.tsx');
  const tokenRead = auth.indexOf('getStoredNativePushToken()');
  const serverDelete = auth.indexOf('method: "DELETE"', tokenRead);
  const unregister = auth.indexOf('await unregisterNativePush()', tokenRead);
  const clearSession = auth.indexOf('clearSessionTokens()', tokenRead);

  assert.ok(tokenRead >= 0);
  assert.ok(serverDelete > tokenRead);
  assert.ok(unregister > serverDelete);
  assert.ok(clearSession > unregister);
});

test('native push registration is gated until Firebase Android config is explicitly enabled', () => {
  const nativeState = read('client/src/lib/native-push.ts');
  const nativeHook = read('client/src/hooks/useNativePush.ts');
  const syncHook = read('client/src/hooks/useSyncFcmToken.ts');
  assert.match(nativeState, /VITE_ANDROID_NATIVE_PUSH_ENABLED === 'true'/);
  assert.match(nativeState, /if \(!isNativePushEnabled\(\)\) return;/);
  assert.match(nativeHook, /const enabled = isNativePushEnabled\(\)/);
  assert.match(nativeHook, /if \(!enabled\) return;/);
  assert.match(syncHook, /if \(!user\?\.id \|\| !enabled\) return;/);
});

test('native push build helper validates the canonical Firebase Android config', () => {
  const helper = read('client/scripts/build-android-native-push.mjs');
  const packageJson = read('client/package.json');
  assert.match(helper, /EXPECTED_PROJECT_ID = 'demos-finale'/);
  assert.match(helper, /EXPECTED_PACKAGE_NAME = 'community\.demos'/);
  assert.match(helper, /VITE_ANDROID_NATIVE_PUSH_ENABLED: 'true'/);
  assert.match(helper, /google-services\.json does not contain Android package/);
  assert.match(packageJson, /"android:sync:push"\s*:\s*"node scripts\/build-android-native-push\.mjs"/);
});
