// Guard against fetching the entire admin notification history on page mount.
// This static contract avoids credentials, API requests and real notifications.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../client/src/pages/NotificheTotali/index.tsx'), 'utf8');

test('admin notification history is loaded only on the history tab', () => {
  assert.match(source, /const \[activeTab, setActiveTab\] = useState\("invio"\)/);
  assert.match(source, /<Tabs value=\{activeTab\} onValueChange=\{setActiveTab\}/);
  assert.match(source, /queryKey: \["notifiche-totali"\],[\s\S]*?enabled: isAdmin && activeTab === "cronologia"/);
  assert.match(source, /refetchInterval: activeTab === "cronologia" \? 60000 : false/);
  assert.match(source, /staleTime: 60000/);
  assert.match(source, /refetchOnWindowFocus: false/);
  assert.match(source, /refetchIntervalInBackground: false/);
});
