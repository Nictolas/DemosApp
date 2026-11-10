'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Android permission is not requested automatically before onboarding', () => {
  const sync = read('client/src/hooks/useSyncFcmToken.ts');
  assert.match(sync, /if \(transport === 'native'\) \{\s*if \(!fcmToken\) return;/);
  assert.match(sync, /if \(permission === 'granted' && !fcmToken\)/);
  assert.match(sync, /source: transport === 'native' \? 'android-native'/);
});

test('civic onboarding is Android-only, account-specific and explicitly optional', () => {
  const screen = read('client/src/components/CivicNotificationOnboarding.tsx');
  const app = read('client/src/App.tsx');
  assert.match(app, /<CivicNotificationOnboarding \/>/);
  assert.match(screen, /if \(!isNativePushEnabled\(\)\) return null;/);
  assert.match(screen, /"demos_civic_onboarding_v1_" \+ userId/);
  assert.match(screen, /"Non ora"/);
  assert.match(screen, /onClick=\{finish\}/);
  assert.match(screen, /"Attiva tutte le notifiche civiche"/);
  assert.match(screen, /"Iniziative popolari italiane"/);
  assert.match(screen, /"Referendum abrogativi"/);
  assert.match(screen, /"Iniziative dei cittadini europei/);
});

test('saving requires user action, fresh preferences, and success before OS prompt', () => {
  const screen = read('client/src/components/CivicNotificationOnboarding.tsx');
  const confirm = screen.slice(screen.indexOf('const confirm = async'), screen.indexOf('if (!isNativePushEnabled()) return null;'));
  assert.match(confirm, /if \(!user\?\.id \|\| !preferences \|\| saving/);
  assert.match(confirm, /activeAccountId\.current !== initiatingUser/);
  assert.match(confirm, /isCompletePreferences\(current\.data\?\.preferenze\)/);
  assert.match(confirm, /preferenze: \{ \.\.\.current\.data\.preferenze, \.\.\.choices \}/);
  assert.match(confirm, /if \(!result\.success\) throw new Error/);
  assert.ok(confirm.indexOf('finish();') < confirm.indexOf('await push.requestPermission()'));
  assert.ok(confirm.indexOf('apiRequest.post(') < confirm.indexOf('await push.requestPermission()'));
  assert.ok(confirm.indexOf('apiRequest.get<') < confirm.indexOf('apiRequest.post('));
  assert.match(screen, /disabled=\{saving \|\| loading \|\| !preferences \|\| !hasSelection\}/);
});
