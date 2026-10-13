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
  const legacyWrite = route.indexOf("UPDATE users SET fcm_tokens = $1", validation);
  assert.ok(validation >= 0);
  assert.ok(existingLookup > validation);
  assert.ok(legacyWrite > validation);
  assert.doesNotMatch(route, /Token: \$\{token\.substring/);
});

test('legacy cache service worker remains disabled instead of competing with FCM root scope', () => {
  const main = read('client/src/main.tsx');
  assert.doesNotMatch(main, /^\s*navigator\.serviceWorker\.register\('\/sw\.js'\)/m);
});
