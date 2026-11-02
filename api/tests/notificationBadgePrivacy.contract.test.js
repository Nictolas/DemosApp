'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.resolve(__dirname, '../../', file), 'utf8');
const badge = read('client/src/hooks/useNotificationBadge.ts');
const page = read('client/src/pages/Notifiche/hooks/useNotificheData.ts');
const shared = read('client/src/lib/notificationFeed.ts');

test('badge and page use one account-scoped React Query entry and the same fetcher', () => {
  for (const src of [badge, page]) {
    assert.match(src, /queryKey: notificationFeedKey\(user\?\.id\)/);
    assert.match(src, /queryFn: fetchNotificationFeed/);
    assert.match(src, /enabled: isValidNotificationUserId\(user\?\.id\)/);
    assert.match(src, /\.\.\.notificationFeedQueryPolicy/);
    assert.doesNotMatch(src, /queryKey: \['notificationBadge'/);
  }
  assert.match(shared, /\["notifiche", userId \?\? null\]/);
  assert.match(shared, /UUID_PATTERN\.test\(id\)/);
});

test('shared fetch reads apiRequest response.data, validates server envelope, omits user ID', () => {
  assert.match(shared, /apiRequest\("GET", "\/api\/notifiche"\)/);
  assert.match(shared, /const payload = response\?\.data/);
  assert.match(shared, /payload\?\.success !== true/);
  assert.match(shared, /Array\.isArray\(payload\?\.notifiche\)/);
  assert.doesNotMatch(shared, /\?user_id=|console\.(?:log|warn|error)/);
  assert.doesNotMatch(badge, /\?user_id=/);
  // The page still has an unrelated administrative DELETE request; do not
  // confuse it with the shared, privacy-minimized notification GET.
  const pageRead = page.split('// Mutazione per cancellare segnalazione')[0];
  assert.doesNotMatch(pageRead, /apiRequest\("GET",\s*[`'"]\/api\/notifiche|\?user_id=/);
});

test('background polling disabled and page/badge share one 60s refresh policy', () => {
  assert.match(shared, /refetchInterval:\s*60_000/);
  assert.match(shared, /refetchIntervalInBackground:\s*false/);
  assert.match(shared, /staleTime:\s*90_000/);
  assert.match(shared, /refetchOnWindowFocus:\s*true/);
  assert.doesNotMatch(badge, /refetchInterval: 45000/);
  assert.doesNotMatch(page, /refetchInterval: 60000/);
});

test('badge does not falsely count missing notification status as unread', () => {
  assert.match(badge, /n\.status === "non_letta"/);
  assert.doesNotMatch(badge, /status !== ['"]letta['"]/);
  assert.match(badge, /notificationCount = notifications\.length/);
  assert.match(badge, /hasReliableReadState/);
});

test('notification write surfaces invalidate the shared feed cache instead of a dead badge key', () => {
  const writers = [
    'client/src/pages/NotificheDemos.tsx',
    'client/src/pages/NotificheTotali/index.tsx',
    'client/src/pages/Votazione.tsx',
    'client/src/pages/InformaCittadini.tsx',
    'client/src/pages/Notifiche/hooks/useNotificheData.ts',
  ];
  for (const file of writers) {
    const src = read(file);
    assert.doesNotMatch(src, /queryKey:\s*\[['"]notificationBadge['"]\]/, file);
    assert.match(src, /invalidateQueries\(\{ queryKey:\s*\[['"]notifiche['"]\]/, file);
  }
});

test('user identity never appears in the shared GET URL, but remains in cache key', () => {
  const src = read('client/src/lib/notificationFeed.ts');
  assert.match(src, /notificationFeedKey = \(userId\?/);
  assert.doesNotMatch(src, /getAuthToken\(|userId.*apiRequest/);
});
