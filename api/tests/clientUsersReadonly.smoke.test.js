const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('/utenti does not expose Admin profile, opinions, avatar or deletion mutations', () => {
  const page = read('client/src/pages/Utenti/index.tsx');
  for (const removed of [
    'EditUserDialog', 'EditOpinioniDialog', 'EditUserAvatarDialog',
    'deleteMutation', 'handleDelete', 'handleEditOpinioni',
    'handleSaveChanges', 'setUserToDelete', 'Salva Modifiche',
    'onEditAvatar=', 'onFieldChange=', 'userChanges='
  ]) {
    assert.equal(page.includes(removed), false, removed + ' must not be reachable');
  }
  assert.match(page, /<UsersTable/);
  assert.match(page, /<MobileUsersTable/);
  assert.doesNotMatch(page, /PendingUsersTable|MobilePendingUsersTable|handleApproveUser|handleRejectUser/);
  assert.doesNotMatch(page, /Utenti in Attesa|In Attesa|pendingUsers/);
  assert.match(page, /<SearchBar/);
  assert.match(page, /<FiltersBar/);
  assert.match(page, /<Pagination/);
});

test('desktop and mobile list rows are read-only, including avatars and grade fields', () => {
  const desktop = read('client/src/pages/Utenti/components/UsersTable.tsx');
  const mobile = read('client/src/pages/Utenti/components/MobileUsersTable.tsx');
  const avatar = read('client/src/pages/Utenti/utils/renderUtils.tsx');
  const management = read('client/src/pages/Utenti/hooks/useUserManagement.ts');
  const loader = read('client/src/pages/Utenti/hooks/useUsers.ts');
  for (const source of [desktop, mobile]) {
    assert.doesNotMatch(source, /\b(onEdit|onEditOpinioni|onDelete|onEditAvatar|onFieldChange|EditableDropdown)\b/);
    assert.doesNotMatch(source, /<Button\b/);
    assert.doesNotMatch(source, /\b(Elimina|Opinioni)\b/);
  }
  assert.doesNotMatch(desktop, /<TableHead[^>]*>Azioni<\/TableHead>/);
  assert.match(mobile, /user\.grado_elezione/);
  assert.match(mobile, /user\.grado_candidatura/);
  assert.doesNotMatch(avatar, /onEditAvatar|Clicca per modificare l'avatar/);
  assert.doesNotMatch(management, /userToDelete|showEditDialog|showEditOpinioniDialog/);
  assert.doesNotMatch(loader, /deleteMutation|apiRequest\("DELETE"/);
});

test('canonical deletion services stay available for GDPR and account self-service', () => {
  const admin = read('api/routes/users/admin.js');
  const self = read('api/routes/user/delete-account.js');
  const service = read('api/services/privacyErasureLedgerService.js');
  assert.match(admin, /router\.delete\('\/:userId'/);
  assert.match(admin, /PrivacyErasureLedgerService\.enforceAccountDeletion\(client, userId\)/);
  assert.match(self, /PrivacyErasureLedgerService\.enforceAccountDeletion\(client, userId\)/);
  assert.match(service, /static async enforceAccountDeletion/);
});

test('user totals appear only under Statistiche, not as redundant cards in Gestisci', () => {
  const page = read('client/src/pages/Utenti/index.tsx');
  const gestisci = page.slice(page.indexOf('<TabsContent value="gestisci"'), page.indexOf('<TabsContent value="statistiche"'));
  const statistiche = page.slice(page.indexOf('<TabsContent value="statistiche"'));
  assert.ok(gestisci.length > 100, 'Gestisci tab is present');
  assert.doesNotMatch(gestisci, /Totale Utenti|text-green-900|text-blue-900/);
  assert.doesNotMatch(gestisci, /\{allUsers\.length\}/);
  assert.match(gestisci, /Tutti gli Utenti/);
  assert.match(gestisci, /<UsersTable/);
  assert.match(gestisci, /<MobileUsersTable/);
  assert.match(statistiche, /stats\.totalUsers/);
});
