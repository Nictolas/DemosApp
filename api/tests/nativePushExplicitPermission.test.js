'use strict';

// Offline consent contract: never pop the OS/browser permission prompt merely
// because a user signed in. Only the explicit Preferences UI button can ask.
// No Firebase, user data, backend calls or device credentials in these tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('automatic token sync never requests OS/browser notification permission', () => {
  const sync = read('client/src/hooks/useSyncFcmToken.ts');
  assert.doesNotMatch(sync, /\brequestPermission\s*\(/);
  assert.doesNotMatch(sync, /push_permission_requested_/);
  assert.match(sync, /if \(!user\?\.id \|\| !enabled\) return;/);
  const gate = sync.indexOf("if (permission !== 'granted') return;");
  const getToken = sync.indexOf('void getToken()');
  const post = sync.indexOf("apiRequest('POST', '/api/fcm-tokens'");
  assert.ok(gate > 0 && getToken > gate && post > getToken,
    'both registration and API persistence must occur only after an existing OS grant');
});

test('explicit preference screen provides the only user-triggered permission prompt', () => {
  const prefs = read('client/src/pages/NotifichePreferenze.tsx');
  const hook = read('client/src/hooks/useNativePush.ts');
  assert.match(prefs, /onClick=\{\(\) => void push\.requestPermission\(\)\}/);
  assert.match(prefs, /wantsCivicPush/);
  assert.match(prefs, /Consenti notifiche/);
  assert.match(hook, /const requestPermission = useCallback\(async \(\) => \{/);
  assert.match(hook, /PushNotifications\.requestPermissions\(\)/);
  assert.doesNotMatch(prefs, /useEffect\([\s\S]*push\.requestPermission\(/);
});

test('civic preferences are initially OFF and grant is separate from category opt-in', () => {
  const prefs = read('client/src/pages/NotifichePreferenze.tsx');
  for (const key of ['iniziative_popolari', 'referendum_abrogativi', 'eci']) {
    assert.match(prefs, new RegExp('\\b'+key+': false'));
  }
  assert.match(prefs, /apiRequest\.post\("\/notifiche\/preferenze", \{/);
  const sync = read('client/src/hooks/useSyncFcmToken.ts');
  assert.doesNotMatch(sync, /subscribeToTopic|CIVIC_PUSH_ENABLED|civic_push_delivery_guard/);
});
