'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../client/src/pages/Gestisci');
const page = fs.readFileSync(path.join(root, 'ProposteSoggetti.tsx'), 'utf8');
const demo = fs.readFileSync(path.join(root, 'demoSubjectProposals.ts'), 'utf8');

test('Admin preview contains only four visibly fictitious staging labels', () => {
  assert.equal((demo.match(/id: "test-/g) || []).length, 4);
  for (const category of ['capo_stato', 'amnistia', 'attivisti', 'organizzazioni']) {
    assert.ok(demo.includes('category: "' + category + '"'));
  }
  assert.equal((demo.match(/FITTIZI[OA] ?/g) || []).length, 4);
  assert.doesNotMatch(demo.slice(demo.indexOf("export const")), /@|proposer_user_id|votes|voti_|http:/i);
});

test('Demo only renders on explicit Admin toggle and never enters moderation API path', () => {
  assert.match(page, /const \[showDemo, setShowDemo\] = useState\(false\)/);
  assert.match(page, /if \(!isAdmin\) return <Redirect/);
  assert.match(page, /setShowDemo\(value => !value\)/);
  const start = page.indexOf('{!showApproved && !showUndelivered && showDemo && (');
  const end = page.indexOf('{!showApproved && !showUndelivered && pending.map(p => (', start);
  assert.ok(start > 0 && end > start, 'Demo and actual moderation must be separate');
  const preview = page.slice(start, end);
  assert.match(preview, /DEMO_SUBJECT_PROPOSALS\.map/);
  assert.match(preview, /MODALITÀ TEST/);
  assert.equal((preview.match(/<Button[^>]*disabled>/g) || []).length, 2);
  assert.doesNotMatch(preview, /\bapiRequest\s*\(|\breview\s*\(|\bwithdraw\s*\(|\battestVideoVerification\s*\(/);
  assert.match(page.slice(end), /pending\.map\(p =>/);
});

test('Production empty queue is still explicitly distinguished from synthetic examples', () => {
  assert.match(page, /Nessuna proposta reale in attesa/);
  assert.match(page, /Nessun utente o voto viene creato/);
});