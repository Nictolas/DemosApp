'use strict';
// DRAFT-only static contracts for the public directory entry points.
// The PostgreSQL 17 integration suite independently checks actual /approved JSON.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const file = p => fs.readFileSync(path.join(root,p),'utf8');

const publicQuery = /SELECT id, title FROM subject_proposals WHERE (?:category=\$1 AND status='approved'|status='approved' AND category=\$1) ORDER BY reviewed_at DESC LIMIT 100/;

test('all three public catalogue endpoints select only approved ID and title', () => {
  for (const p of ['api/routes/subject-proposals.js','api/routes/attivisti.js','api/routes/organizzazioni.js']) {
    const s = file(p);
    assert.match(s, publicQuery, 'Approved directory must be minimal in ' + p);
    assert.doesNotMatch(s, /SELECT id, title, details, source_url FROM subject_proposals/i,
      'Never return user-supplied narrative or source URL in ' + p);
  }
});

test('moderation still reads original evidence internally and remains Admin-protected', () => {
  const source = file('api/routes/subject-proposals.js');
  assert.match(source, /router\.get\('\/admin', verifyToken, requireAdmin/);
  assert.match(source, /SELECT id, category, title, details, source_url, created_at FROM subject_proposals/);
  assert.match(source, /router\.post\('\/admin\/:id\/decision', verifyToken, requireAdmin/);
  assert.match(source, /SELECT \* FROM subject_proposals WHERE id=\$1 AND status='pending' FOR UPDATE/);
});

test('both approved-catalogue cards only show title and are not presented as verified DEMOS accounts', () => {
  for (const p of ['client/src/pages/Attivisti/index.tsx','client/src/pages/Organizzazioni/index.tsx']) {
    const s=file(p);
    assert.match(s, /subject\.title/,'must preserve approved subject label in ' + p);
    assert.doesNotMatch(s, /subject\.details|subject\.source_url/,
      'public catalogue cannot render private narrative or source in ' + p);
    assert.match(s, /non (?:è ancora un profilo|un account) DEMOS verificato/i,
      'never imply public nomination is a verified DEMOS account');
  }
});

test('Admin withdrawal UI never treats a notification outage as failed unpublishing', () => {
  const api = file('api/routes/subject-proposals.js');
  const ui = file('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  const withdrawal = api.split("router.post('/admin/:id/withdraw'")[1]
    .split("// Atomic review:")[0];
  assert.ok(withdrawal, 'withdrawal route exists');
  assert.ok(withdrawal.indexOf("await client.query('COMMIT')") <
    withdrawal.indexOf('await notify(noticeClient,'),
    'emergency database withdrawal must commit BEFORE independent notification');
  assert.match(withdrawal,/notification_sent: notificationSent/);
  assert.match(withdrawal,/await noticeClient\.query\('BEGIN'\)/);
  assert.match(withdrawal,/await notify\(noticeClient,/);
  assert.match(withdrawal,/UPDATE subject_proposals SET withdraw_notification_sent=TRUE/);
  assert.match(withdrawal,/await noticeClient\.query\('COMMIT'\)/);
  assert.match(withdrawal,/withdraw_notification_sent=FALSE WHERE id=\$1/);
  assert.match(ui,/result\.notification_sent !== true/);
  assert.match(ui,/setUndeliveredNotification\(true\)/);
  assert.match(ui,/role="alert"/);
  assert.match(ui,/segnalarlo al DPO/i);
});

test('unconfirmed withdrawal notification audit is Admin-only, minimal and read on demand', () => {
  const api = file('api/routes/subject-proposals.js');
  const ui = file('client/src/pages/Gestisci/ProposteSoggetti.tsx');
  assert.match(api, /router\.get\('\/admin\/withdraw-notifications', verifyToken, requireAdmin/);
  assert.match(api, /SELECT id, category, withdrawn_at FROM subject_proposals WHERE status='withdrawn'/);
  assert.match(api, /withdraw_notification_sent IS DISTINCT FROM TRUE/);
  assert.match(api, /Cache-Control', 'private, no-store'/);
  assert.doesNotMatch(api.split("router.get('/admin/withdraw-notifications'")[1]
    .split("router.post('/admin/:id/withdraw'")[0], /SELECT[^\n]+(?:proposer_user_id|title|source_url|withdraw_note)/,
    'no third-party title, proposer identity or private notes in the audit');
  assert.match(ui, /const switchUndelivered = \(\) => \{/);
  assert.match(ui, /void refreshUndelivered\(\)/);
  assert.match(ui, /"\/api\/subject-proposals\/admin\/withdraw-notifications"/);
  assert.match(ui, /Avvisi da verificare/);
  assert.match(ui, /non verranno reinviate automaticamente/);
});
