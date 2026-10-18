const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const profile = read('api/routes/users/profile.js');
const candidates = read('api/routes/candidati.js');
const representatives = read('api/routes/rappresentanti.js');
const selectionService = read('api/services/politicalSelectionService.js');
const push = read('api/services/currentSupporterPushService.js');
const opinionNotifications = read('api/services/politicalOpinionNotificationService.js');
const erasure = read('api/services/privacyErasureLedgerService.js');
const migration = read('20261009_political_selections.sql');

test('legacy Italian selection routes write through the canonical political selection service', () => {
  assert.match(profile, /setPoliticalSelection\(client,/);
  assert.match(candidates, /setPoliticalSelection\(client,/);
  assert.match(profile, /getSelectionFieldContract\(campo\)/);
  assert.match(candidates, /getSelectionFieldContract\(realField\)/);
});

test('candidate and representative reads reconcile expired selections with current eligibility', () => {
  assert.match(candidates, /loadCurrentPoliticalSelections\(pool, \{ userId, kind: 'candidate', adapterId: 'it' \}\)/);
  assert.match(representatives, /loadCurrentPoliticalSelections\(pool, \{ userId, kind: 'representative', adapterId: 'it' \}\)/);
  assert.match(selectionService, /catch \(error\)[\s\S]*loadLegacySelections/);
});

test('generic political selection endpoint accepts office identity instead of an Italian database column name', () => {
  const start = profile.indexOf("router.put('/:userId/political-selection'");
  const end = profile.indexOf('// GET /api/users/:userId/opinioni', start);
  const block = profile.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /kind, officeId, selectedUserId/);
  assert.match(block, /resolveSelectionContract\(\{ kind, officeValue: officeId \}\)/);
  assert.match(block, /setPoliticalSelection\(client,/);
  assert.doesNotMatch(block, /\bcampo\b|rappresentante_camera|candidato_camera/);
});

test('supporter push and opinion-change notifications resolve supporters through the canonical relation', () => {
  assert.match(push, /loadSupporterUserIds/);
  assert.match(opinionNotifications, /loadSupporterUserIds/);
  assert.match(selectionService, /FROM political_selections ps/);
});

test('account erasure explicitly removes political selections in both user directions', () => {
  assert.match(erasure, /\['political_selections', 'user_id'\]/);
  assert.match(erasure, /\['political_selections', 'selected_user_id'\]/);
});

test('political selection migration is additive, backfills Italy and enables RLS without public policies', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS political_selections/);
  assert.match(migration, /legacy_backfill/);
  assert.match(migration, /'eu\.parliament\.it'/);
  assert.match(migration, /'it\.camera'/);
  assert.match(migration, /'it\.senato'/);
  assert.match(migration, /ALTER TABLE political_selections ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /CREATE POLICY/i);
});
