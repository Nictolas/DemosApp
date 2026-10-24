const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const writer = read('api/routes/opinioni/user-answers.js');
const feed = read('api/routes/notifiche.js');
const service = read('api/services/politicalOpinionNotificationService.js');
const selectionService = read('api/services/politicalSelectionService.js');
const migration = read('20261009_political_opinion_notifications.sql');
const erasure = read('api/services/privacyErasureLedgerService.js');

test('opinion write and supporter notifications share one transaction', () => {
  assert.match(writer, /const client = await pool\.connect\(\)/);
  assert.match(writer, /await client\.query\('BEGIN'\)/);
  assert.match(writer, /FOR UPDATE/);
  assert.match(writer, /createSupporterOpinionNotifications\(client,/);
  assert.match(writer, /await client\.query\('COMMIT'\)/);
  assert.match(writer, /await client\.query\('ROLLBACK'\)/);
});

test('first answer and unchanged answer do not create change notifications', () => {
  assert.match(writer, /Prima risposta: salva, ma non notificare i sostenitori/);
  assert.match(writer, /\['f', 'c', 'i'\]\.includes\(change\.previousValue\)/);
  assert.match(writer, /change\.previousValue !== change\.newValue/);
  assert.match(service, /previousValue === newValue/);
  assert.match(service, /!VALID_VALUES\.has\(previousValue\)/);
});

test('only Politician/Candidate self-writes emit supporter notifications', () => {
  assert.match(writer, /req\.user\?\.isPolitician \|\| req\.user\?\.isCandidate/);
  assert.match(writer, /subjectUserId: userId/);
});

test('current canonical selections are the supporter source and historical supporter tables are not used', () => {
  assert.match(service, /loadSupporterUserIds/);
  assert.match(selectionService, /FROM political_selections ps/);
  assert.match(selectionService, /source: 'LEGACY'/);
  assert.doesNotMatch(service, /rappresentante_|candidato_|FROM\s+sostenitori\b/i);
});

test('notification migration stores recipient, subject and actual before/after public position', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS political_opinion_notifications/);
  assert.match(migration, /recipient_user_id UUID NOT NULL/);
  assert.match(migration, /subject_user_id UUID NOT NULL/);
  assert.match(migration, /previous_value TEXT NOT NULL/);
  assert.match(migration, /new_value TEXT NOT NULL/);
  assert.match(migration, /CHECK \(previous_value <> new_value\)/);
});

test('notification feed and latest notification are recipient-specific', () => {
  const recipientQueries = feed.match(/WHERE pon\.recipient_user_id = \$1/g) || [];
  assert.ok(recipientQueries.length >= 2);
  assert.match(feed, /tipo_notifica: 'cambio_opinione'/);
  assert.match(feed, /political_opinion_notifications/);
});

test('latest notification follows canonical feed targeting instead of legacy global fallbacks', () => {
  assert.match(feed, /const userId = req\.user\.id/);
  assert.match(feed, /rappresentante_comune/);
  assert.match(feed, /FROM notifiche_voti_comuni[\s\S]*WHERE id_utente = \$1::uuid/);
  assert.doesNotMatch(feed, /if \(!isAdmin && userComuneResidenza\)/);
  assert.match(feed, /FROM notifiche_demos\s+WHERE \(titolo IS NULL OR titolo NOT LIKE 'DEMOS — %' OR id_utente = \$1::uuid\)/);
  assert.match(feed, /FROM notifiche_comunali/);
  assert.match(feed, /FROM political_opinion_notifications pon/);
});

test('account erasure deletes both recipient and subject links', () => {
  assert.match(erasure, /\['political_opinion_notifications', 'recipient_user_id'\]/);
  assert.match(erasure, /\['political_opinion_notifications', 'subject_user_id'\]/);
});

test('notification UI explicitly supports political opinion changes', () => {
  const types = read('client/src/pages/Notifiche/types/index.ts');
  const item = read('client/src/pages/Notifiche/components/NotificaItem.tsx');
  assert.match(types, /'cambio_opinione'/);
  assert.match(types, /opinion_id\?: string \| null/);
  assert.match(types, /opinion_text\?: string \| null/);
  assert.match(item, /case 'cambio_opinione'/);
  assert.match(item, /tipoNotifica === 'cambio_opinione'/);
});
