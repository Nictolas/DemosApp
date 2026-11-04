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
  // Only inspect effect/handler source, not the JSX click handler below.
  const lifecycle = prefs.slice(0, prefs.indexOf('  if (!user) {'));
  assert.doesNotMatch(lifecycle, /push\.requestPermission\(/);
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

test('permission propagation reaches both mounted hook instances without another prompt', () => {
  const bridge = read('client/src/lib/push-permission-events.ts');
  const native = read('client/src/hooks/useNativePush.ts');
  const web = read('client/src/hooks/useFCM.ts');
  const sync = read('client/src/hooks/useSyncFcmToken.ts');

  assert.ok(bridge.includes('window.dispatchEvent(new Event(PUSH_PERMISSION_CHANGED_EVENT))'));
  assert.doesNotMatch(bridge, /detail:|fcmToken|userId|localStorage|sessionStorage/);
  for (const [transport, hook] of [['native', native], ['web', web]]) {
    assert.ok(hook.includes('window.addEventListener(PUSH_PERMISSION_CHANGED_EVENT, refreshPermission)'),
      transport + ' must recheck permission after the other hook grants it');
    assert.ok(hook.includes('window.removeEventListener(PUSH_PERMISSION_CHANGED_EVENT, refreshPermission)'),
      transport + ' must unsubscribe on unmount');
    assert.ok(hook.includes('notifyPushPermissionChanged()'),
      transport + ' must broadcast explicit consent state changes');
  }
  assert.ok(native.includes('PushNotifications.checkPermissions()'));
  assert.ok(web.includes('Notification.permission'));
  assert.ok(sync.includes("if (permission !== 'granted') return;"));
});
