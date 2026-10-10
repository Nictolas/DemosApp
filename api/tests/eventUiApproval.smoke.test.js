const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const eventi = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'Eventi.tsx'), 'utf8');
const evento = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'Evento.tsx'), 'utf8');
const feed = fs.readFileSync(path.join(ROOT, 'api', 'services', 'eventFeedService.js'), 'utf8');

test('Eventi Admin UI uses canonical capability and exposes the Staff moderation queue', () => {
  assert.match(eventi, /user\?\.is_admin \?\? user\?\.capabilities\?\.isAdmin/);
  assert.match(eventi, /activeTab.*'pending'/s);
  assert.match(eventi, /\/api\/eventi\/admin\/pending/);
  assert.match(eventi, /\/api\/eventi\/\$\{eventId\}\/\$\{action\}/);
});

test('event ownership in the UI prefers creator_user_id over organizer display text', () => {
  assert.match(eventi, /evento\?\.creator_user_id/);
  assert.match(eventi, /String\(evento\.creator_user_id\) === String\(user\?\.id/);
});

test('event creation is capability-aware and communicates pending Staff review', () => {
  assert.match(evento, /accountType === 'INSTITUTION'/);
  assert.match(evento, /user\?\.capabilities\?\.isCandidate/);
  assert.match(evento, /pending_staff_review/);
  assert.match(evento, /Staff deve approvare l'evento/);
  assert.doesNotMatch(evento, /organizzatore:\s*user\?/);
});

test('personalized feed keys selected-subject priority on canonical creator id and canonical political selections', () => {
  assert.match(feed, /loadPoliticalSelections/);
  assert.match(feed, /creator_user_id/);
  assert.match(feed, /selectedIds\.has\(String\(event\.creator_user_id\)\)/);
});
