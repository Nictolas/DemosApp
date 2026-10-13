const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const types = read('client/src/pages/Notifiche/types/index.ts');
const item = read('client/src/pages/Notifiche/components/NotificaItem.tsx');

test('notification UI contract includes cambio_opinione explicitly', () => {
  assert.match(types, /'cambio_opinione'/);
  assert.match(types, /opinion_id\?: string \| null/);
  assert.match(types, /opinion_text\?: string \| null/);
});

test('opinion-change notifications have their own visual treatment', () => {
  assert.match(item, /case 'cambio_opinione':/);
  assert.match(item, /emoji: '🔄'/);
  assert.match(item, /bg-purple-50 border-purple-200/);
  assert.match(item, /text-purple-900/);
});

test('opinion-change notifications can show the politician/candidate avatar', () => {
  assert.match(
    item,
    /tipoNotifica === 'voto_comune' \|\| tipoNotifica === 'voto_parlamento' \|\| tipoNotifica === 'cambio_opinione'/,
  );
  assert.match(item, /tipoNotifica === 'cambio_opinione' \? 'border-purple-300'/);
});

test('opinion-change notifications do not enter reaction/vote flows', () => {
  assert.doesNotMatch(item, /shouldLoadReactions[^\n]*cambio_opinione/);
  assert.doesNotMatch(item, /handleReaction[^\n]*cambio_opinione/);
});
