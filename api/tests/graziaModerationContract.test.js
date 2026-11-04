'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Grazia proposals are stored privately and one pending per owner via row lock', () => {
  const source = read('api/routes/grazia.js');
  assert.match(source, /router\.post\('\/', personalNoStore, verifyToken, async/);
  assert.match(source, /SELECT id FROM users WHERE id = \$1 FOR UPDATE/);
  assert.match(source, /FROM richieste_grazia WHERE utente_id = \$1 AND status = 'pending'/);
  assert.match(source, /INSERT INTO richieste_grazia \(id, utente_id, nome, url_prova, status, data_creazione\)/);
  assert.match(source, /return res\.status\(409\)/);
  assert.match(source, /return res\.status\(202\)\.json\(\{\s*success: true/);
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
  assert.match(source, /router\.get\('\/richieste', personalNoStore, verifyToken, requireAdmin/);
  assert.match(source, /FROM richieste_grazia WHERE status = 'pending' ORDER BY/);
  assert.match(source, /router\.post\('\/richiesta\/:id\/:action', personalNoStore, verifyToken, requireAdmin/);
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

test('Grazia personal votes and third-party proposals never reach HTTP cache or raw SQL error payloads', () => {
  const source = read('api/routes/grazia.js');
  assert.match(source, /const personalNoStore/);
  assert.match(source, /private, no-store, max-age=0/);
  for (const path of ["'/'", "'/richieste'", "'/mia-proposta'", "'/vota'", "'/richiesta/:id/:action'"]) {
    assert.ok(source.includes(path + ', personalNoStore'), 'missing cache guard '+path);
  }
  assert.doesNotMatch(source, /details:\s*error\.message|error:\s*error\.message/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:userId|error\.message|error\.stack|error\.detail|mieiVoti|voti\.length)/);
  assert.match(source, /await client\.query\('COMMIT'\);[\s\S]{0,260}?client\.release\(\);\s*client = null;\s*let notificationSent = false;/);
});

test('Grazia withdrawal remains on its own queue, keeps votes and has private audit', () => {
  const route=read('api/routes/grazia.js');
  const migration=read('api/migrations/20261104_grazia_withdrawal_audit.sql');
  const rollback=read('api/migrations/20261104_grazia_withdrawal_audit_rollback.sql');
  const ui=read('client/src/pages/GestisciGrazia.tsx');
  for(const key of ['withdrawn_at','withdrawn_by','withdraw_note','withdraw_notification_sent']){
    assert.match(migration,new RegExp('ADD COLUMN IF NOT EXISTS '+key));
    assert.match(rollback,new RegExp('DROP COLUMN IF EXISTS '+key));
  }
  assert.match(rollback,/RAISE EXCEPTION 'Grazia withdrawal audit exists/);
  assert.match(route,/router\.post\('\/richiesta\/:id\/ritira', personalNoStore, verifyToken, requireAdmin/);
  assert.match(route,/WHERE id=\$1 AND status='approved' AND withdrawn_at IS NULL FOR UPDATE/);
  assert.match(route,/UPDATE grazia_carcerati SET attivo=FALSE WHERE attivo=TRUE/);
  assert.match(route,/UPDATE richieste_grazia SET withdrawn_at=now\(\),withdrawn_by=/);
  const withdrawing=route.split("router.post('/richiesta/:id/ritira'")[1].split("// POST /api/grazia/richiesta/:id/:action")[0];
  assert.match(withdrawing,/await client\.query\('COMMIT'\)/);
  assert.match(withdrawing,/await noticeClient\.query\('BEGIN'\)/);
  assert.match(withdrawing,/withdraw_notification_sent=TRUE/);
  assert.doesNotMatch(withdrawing,/\b(?:DELETE|TRUNCATE)\s+(?:FROM\s+)?voti_grazia/i);
  assert.match(route,/CASE WHEN withdrawn_at IS NOT NULL THEN 'withdrawn' ELSE status END AS status/);
  assert.match(route,/router\.get\('\/approvate', personalNoStore, verifyToken, requireAdmin/);
  assert.match(route,/router\.get\('\/ritiri-avvisi', personalNoStore, verifyToken, requireAdmin/);
  assert.match(route,/withdraw_notification_sent IS DISTINCT FROM TRUE/);
  assert.match(route,/Soggetto non riproponibile/);
  assert.match(ui,/enabled:!!user && isAdmin && showPublished/);
  assert.match(ui,/enabled:!!user && isAdmin && showUnconfirmed/);
  assert.match(ui,/api\/grazia\/richiesta\/\$\{encodeURIComponent\(id\)\}\/ritira/);
});

test('Grazia voting locks the approved catalogue row inside its own transaction', () => {
  const route=read('api/routes/grazia.js');
  const voting=route.split("router.post('/vota'")[1].split('// Grazia keeps one canonical queue')[0];
  const begin=voting.indexOf("await client.query('BEGIN')");
  const lock=voting.indexOf("'SELECT id FROM grazia_carcerati WHERE attivo = true AND LOWER(BTRIM(nome)) = LOWER($1) FOR SHARE'");
  const deletion=voting.indexOf("DELETE FROM voti_grazia");
  assert.ok(begin>=0 && lock>begin && deletion>lock,
    'a candidate must remain locked from its recheck through deleting/inserting preferences');
  assert.match(voting,/if \(!stillActive\.rows\.length\) \{\s*await client\.query\('ROLLBACK'\);\s*return res\.status\(422\)/);
  assert.doesNotMatch(voting.slice(lock,deletion),/await client\.query\('COMMIT'\)/);
});

test('Grazia pending Admin queue includes only fields needed for review', () => {
  const source=read('api/routes/grazia.js');
  const route=source.slice(
    source.indexOf("router.get('/richieste'"),
    source.indexOf("router.get('/mia-proposta'")
  );
  assert.match(route,/verifyToken, requireAdmin/);
  assert.match(route,/personalNoStore/);
  assert.match(route,/SELECT id, nome, url_prova AS/);
  assert.match(route,/data_creazione AS/);
  assert.doesNotMatch(route,/utente_id/);
  assert.doesNotMatch(route,/proposer_user_id/);
});
