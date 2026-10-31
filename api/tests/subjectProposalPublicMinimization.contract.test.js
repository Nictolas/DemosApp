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
