const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const content = fs.readFileSync(path.join(__dirname, '../services/privacyErasureLedgerService.js'), 'utf8');
test('privacy workflow covers DEMOS and municipal notifications', () => {
  assert.match(content, /\['notifiche_demos', 'id_utente'\]/);
  assert.match(content, /\['notifiche_comunali', 'id_utente'\]/);
  assert.match(content, /\['political_selections', 'user_id'\]/);
  assert.match(content, /\['programmi', 'utente_id'\]/);
});
