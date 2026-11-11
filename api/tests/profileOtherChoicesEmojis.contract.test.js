const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const read = name => readFileSync(resolve(__dirname, '../..', name), 'utf8');

test('Amnistia and Iniziativa popolare display topic emojis before the selected title', () => {
  const component = read('client/src/pages/Profilo/components/ProfileChosenPreferences.tsx');
  assert.match(component, /import \{ getLeggeEmoji \} from/);
  assert.match(component, /import \{ getInitiativeChoiceEmoji \} from/);
  assert.match(component, /key === "amnistia" \|\| key === "iniziativa"/);
  assert.match(component, /getLeggeEmoji\(value\) : getInitiativeChoiceEmoji\(value\)/);
  assert.match(component, /data-testid="profile-other-choice-emoji"/);
  assert.ok(component.indexOf('data-testid="profile-other-choice-emoji"') <
    component.indexOf('{value}</span>'));
  assert.doesNotMatch(component, /\bfetch\s*\(|apiRequest\s*\(|useQuery\s*\(/);
});

test('profile initiative category mapping stays aligned with the existing public list', () => {
  const frontend = read('client/src/pages/Profilo/utils/initiativeChoiceEmoji.ts');
  const backend = read('api/routes/iniziative-popolari.js');
  const frontCategories = frontend.match(/const emojiCategories: ReadonlyArray<readonly \[readonly string\[\], string\]> = (\[[\s\S]*?\n\]);/);
  const backCategories = backend.match(/const emojiMap = (\[[\s\S]*?\n  \]);/);
  assert.ok(frontCategories, 'profile categories found');
  assert.ok(backCategories, 'official initiative categories found');
  const front = vm.runInNewContext('(' + frontCategories[1] + ')');
  const back = vm.runInNewContext('(' + backCategories[1] + ')');
  assert.deepEqual(JSON.parse(JSON.stringify(front)),
    JSON.parse(JSON.stringify(back.map(({ keywords, emoji }) => [keywords, emoji]))));

  const compile = frontend
    .replace(/const emojiCategories: ReadonlyArray<readonly \[readonly string\[\], string\]> =/, 'const emojiCategories =')
    .replace(/export function getInitiativeChoiceEmoji\(title: string\): string/, 'function getInitiativeChoiceEmoji(title)');
  const getEmoji = vm.runInNewContext(compile + '\ngetInitiativeChoiceEmoji;');
  assert.equal(getEmoji('BASTA QUORUM PER I REFERENDUM! CHI VOTA DECIDE.'), '🗳️');
  assert.equal(getEmoji('Diritto alla salute'), '🏥');
  assert.equal(getEmoji('Iniziativa senza categoria'), '📋');
});
