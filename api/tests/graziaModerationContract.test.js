'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Grazia proposals are stored privately and one pending per owner via row lock', () => {
  const source = read('api/routes/grazia.js');
  assert.match(source, /router\.post\('\/', verifyToken, async/);
  assert.match(source, /SELECT id FROM users WHERE id = \$1 FOR UPDATE/);
  assert.match(source, /FROM richieste_grazia WHERE utente_id = \$1 AND status = 'pending'/);
  assert.match(source, /INSERT INTO richieste_grazia \(id, utente_id, nome, url_prova, status, data_creazione\)/);
  assert.match(source, /return res\.status\(409\)/);
  assert.match(source, /return res\.status\(202\)\.json\(\{ success: true/);
  assert.doesNotMatch(source, /INSERT INTO richieste_grazia \(utente_id, nome_carcerato, motivo, stato/);
});

test('only approved Grazia subjects are publicly ranked and votable', () => {
  const source = read('api/routes/grazia.js');
  assert.match(source, /FROM grazia_carcerati c/);
  assert.match(source, /WHERE c\.attivo = true GROUP BY/);
  assert.match(source, /SELECT id FROM grazia_carcerati WHERE attivo = true AND LOWER\(BTRIM\(nome\)\)/);
  assert.match(source, /return res\.status\(422\)\.json\(\{ success: false, error: 'Soggetto non approvato/);
});

test('Grazia admin reviews requests, not personal votes', () => {
  const source = read('api/routes/grazia.js');
  assert.match(source, /router\.get\('\/richieste', verifyToken, requireAdmin/);
  assert.match(source, /FROM richieste_grazia WHERE status = 'pending' ORDER BY/);
  assert.match(source, /router\.post\('\/richiesta\/:id\/:action', verifyToken, requireAdmin/);
  assert.match(source, /UPDATE richieste_grazia SET status = \$1/);
  assert.match(source, /INSERT INTO grazia_carcerati \(nome, attivo\)/);
  assert.doesNotMatch(source, /UPDATE voti_grazia SET stato/);
});

test('Grazia frontend never pretends an unsaved proposal succeeded or solicits sentences', () => {
  const form = read('client/src/pages/Grazia/components/CarceratoForm.tsx');
  const hook = read('client/src/pages/Grazia/hooks/useGraziaVoting.ts');
  const app = read('client/src/App.tsx');
  const admin = read('client/src/pages/GestisciGrazia.tsx');
  assert.doesNotMatch(form, /Copia della Sentenza|Sarai contattato via email/);
  assert.doesNotMatch(form, /name="email"/);
  assert.match(hook, /await apiRequest\("POST", "\/api\/grazia"/);
  assert.match(hook, /if \(!response\?\.ok \|\| !response\?\.data\?\.success\)/);
  assert.match(app, /<Route path="\/gestisci-grazia">/);
  assert.match(admin, /hasAdminCapability\(user\)/);
  assert.match(admin, /queryKey: \["graziaRequests"\]/);
});
