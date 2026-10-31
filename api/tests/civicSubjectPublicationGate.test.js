'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Amnistia proposals cannot write directly into published catalog', () => {
  const source = read('api/routes/amnistia.js');
  const start = source.indexOf('// POST /api/amnistia - Non creare');
  const end = source.indexOf('// POST /api/amnistia/migrate', start);
  assert.ok(start > 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /router\.post\('\/', verifyToken/);
  assert.match(handler, /code: 'MODERATION_REQUIRED'/);
  assert.match(handler, /res\.status\(409\)/);
  assert.doesNotMatch(handler, /CREATE TABLE|INSERT INTO amnistia/);
  // Institutional migration endpoints remain separate Admin routes.
  assert.match(source.slice(end), /router\.post\('\/migrate', verifyToken, requireAdmin/);
});

test('Amnistia user interface cannot submit a bypass proposal or claim success', () => {
  const hook = read('client/src/pages/Amnistia/hooks/useAmnistiaVoting.ts');
  const form = read('client/src/pages/Amnistia/components/CarceratoForm.tsx');
  assert.doesNotMatch(hook, /fetch\('\/api\/amnistia'/);
  assert.match(hook, /Proposte temporaneamente sospese/);
  assert.match(form, /disabled=\{true\}/);
  assert.match(form, /Proposte temporaneamente sospese/);
  const page = read('client/src/pages/Amnistia/index.tsx');
  assert.doesNotMatch(page, /<CreateButton|<CarceratoForm/, 'the unavailable form must not collect user input');
  assert.match(page, /Le nuove voci vengono valutate prima della pubblicazione/, 'moderated Proponi is available while legacy form is blocked');
  assert.match(page, /ProposeSubjectButton category=/, 'moderated entry remains available');
});

test('Capo di Stato cannot turn an arbitrary vote into a new public candidate', () => {
  const source = read('api/routes/capo-stato.js');
  const start = source.indexOf("router.post('/vota'");
  const end = source.indexOf("// POST /api/capo-stato - endpoint legacy", start);
  assert.ok(start >= 0 && end > start);
  const vote = source.slice(start, end);
  assert.match(vote, /EXISTS \(SELECT 1 FROM voti_capo_stato WHERE nome = \$1\)/);
  assert.match(vote, /EXISTS \(SELECT 1 FROM capo_stato_soggetti_approvati/);
  assert.match(vote, /WHERE active = true AND nome = \$1/);
  assert.match(vote, /return res\.status\(422\)\.json/);
  assert.ok(vote.indexOf("EXISTS (SELECT 1 FROM voti_capo_stato") < vote.indexOf("DELETE FROM voti_capo_stato"),
    'catalogue gate must precede any destructive vote write');
  assert.match(source, /SELECT nome FROM capo_stato_soggetti_approvati WHERE active = true/);
  assert.match(source, /COALESCE\(conteggi\.voti, 0\) AS voti/);
});
