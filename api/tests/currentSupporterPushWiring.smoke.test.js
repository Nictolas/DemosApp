const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const communications = read('api/routes/comunicazioni.js');
const opinions = read('api/routes/opinioni/user-answers.js');
const selectionHook = read('client/src/pages/ScegliRappresentante/hooks/useRappresentantiActions.ts');
const selectionPage = read('client/src/pages/ScegliRappresentante/index.tsx');
const service = read('api/services/currentSupporterPushService.js');
const selectionService = read('api/services/politicalSelectionService.js');

test('client selection no longer subscribes to sticky FCM topics', () => {
  assert.doesNotMatch(selectionHook, /subscribe-topic|unsubscribe-topic|sostenitori_politico_/);
  assert.doesNotMatch(selectionHook, /fcmToken/);
  assert.doesNotMatch(selectionPage, /useFCM|fcmToken/);
});

test('institutional communication push targets current representative selection at the communicated level', () => {
  assert.match(communications, /sendPushToCurrentSupporters\(pool/);
  assert.match(communications, /kind: 'representative'/);
  assert.match(communications, /level,/);
  assert.match(communications, /subjectUserId: targetUserId/);
});

test('political opinion change push targets current representative/candidate selections after commit', () => {
  const commitIndex = opinions.indexOf("await client.query('COMMIT')");
  const pushIndex = opinions.indexOf('await sendPushToCurrentSupporters(pool');
  assert.ok(commitIndex >= 0 && pushIndex > commitIndex);
  assert.match(opinions, /req\.user\?\.isPolitician && req\.user\?\.isCandidate[\s\S]*\? 'both'/);
  assert.match(opinions, /req\.user\?\.isCandidate \? 'candidate' : 'representative'/);
});

test('push recipient identity comes from canonical political selections with legacy fallback isolated in one service', () => {
  assert.match(service, /loadSupporterUserIds/);
  assert.match(service, /u\.id::text = ANY\(\$1::text\[\]\)/);
  assert.match(selectionService, /FROM political_selections ps/);
  assert.match(selectionService, /source: 'LEGACY'/);
  assert.doesNotMatch(service, /sostenitori_politico_/);
  assert.doesNotMatch(service, /subscribeToTopic|unsubscribeFromTopic/);
});
