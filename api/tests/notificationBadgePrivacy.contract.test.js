'use strict';
// Static contract for the browser badge hook; API endpoint is checked in HTTP tests.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../client/src/hooks/useNotificationBadge.ts'),'utf8');

test('badge HTTP fetch does not put user IDs or notification content in URLs or browser logs',()=>{
  assert.match(source,/apiRequest\("GET", "\/api\/notifiche"\)/);
  assert.doesNotMatch(source,/\?user_id=|URLSearchParams|console\.(?:log|warn|error)/);
  assert.match(source,/queryKey: \['notificationBadge', user\?\.id\]/);
});

test('badge refresh is disabled when signed out or in the background, keeps existing 45-second foreground cadence',()=>{
  assert.match(source,/enabled: Boolean\(user\?\.id\)/);
  assert.match(source,/refetchInterval: 45000/);
  assert.match(source,/refetchIntervalInBackground: false/);
  assert.match(source,/refetchOnWindowFocus: true/);
});

test('badge still respects explicit read statuses and avoids reading with an absent identity',()=>{
  assert.match(source,/if \(!user\?\.id\) return 0/);
  assert.match(source,/notifica\.status !== 'letta'/);
});
