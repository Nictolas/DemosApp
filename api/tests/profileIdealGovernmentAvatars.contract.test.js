const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('ideal government endpoint keeps legacy vote names and enriches only with optional public avatars', () => {
  const code = read('api/routes/governo.js');
  const start = code.indexOf("router.get('/ideale', verifyToken");
  const end = code.indexOf("// POST /api/governo", start);
  const route = code.slice(start, end);

  assert.ok(start > 0 && end > start);
  assert.match(route, /WHERE userid = \$1/);
  assert.match(route, /data: governoIdeale/);
  assert.match(route, /loadGovernmentVoteAvatars\(pool, Object\.values\(governoIdeale\)\)/);
  assert.match(route, /avatarPerNome/);
  assert.match(route, /catch \(error\)/);
  assert.ok(route.indexOf('loadGovernmentVoteAvatars') > route.indexOf('for (const ministero of ministeri)'),
    'avatar lookups should be batched after names are loaded');
});

test('profile uses existing 24px avatar to the left of the exact name, otherwise name alone', () => {
  const card = read('client/src/pages/Profilo/components/ProfileGovernoIdeale.tsx');
  const page = read('client/src/pages/Profilo/index.tsx');
  assert.match(card, /import \{ CustomAvatar \} from/);
  assert.match(card, /size=\{24\}/);
  assert.match(card, /avatarPerNome\[nome\.trim\(\)\.replace/);
  assert.match(card, /\{avatarPerNome\[.*\] && \(/);
  assert.match(card, /<span className="min-w-0 break-words">\{nome\}<\/span>/);
  assert.ok(card.indexOf('<CustomAvatar') < card.indexOf('{nome}</span>'));
  assert.match(page, /avatarPerNome=\{governoIdealeAvatars\}/);
  assert.doesNotMatch(card, /\bapiRequest\b|\bfetch\s*\(|useQuery\s*\(/);
});

test('encrypted owner cache is versioned and old name-only entries reload exactly once', () => {
  const hook = read('client/src/pages/Profilo/hooks/useProfileData.ts');
  const vault = read('client/src/pages/Profilo/utils/encryptedProfileVault.ts');
  assert.match(vault, /export type CachedIdealGovernment/);
  assert.match(vault, /version: 2;/);
  assert.match(vault, /government: Record<string, string> \| CachedIdealGovernment \| null;/);
  assert.match(hook, /snapshot\.government\.version === 2 \? snapshot\.government : null/);
  assert.match(hook, /version: 2,\s*votes: payload\.data \|\| \{\},\s*avatarPerNome: payload\.avatarPerNome \|\| \{\}/);
  assert.match(hook, /patchEncryptedProfile\(ownerId, \{ government: result \}, \{ government: revision \}\)/);
  assert.match(hook, /government\.data\?\.votes \|\| \{\}/);
  assert.match(hook, /government\.data\?\.avatarPerNome \|\| \{\}/);
  assert.match(hook, /const politicalAllowed = ownProfile && vaultReady && consentVerified/);
  assert.match(hook, /enabled: enabled && vaultReady && politicalAllowed && panels\.government/);
  assert.match(hook, /removeQueries\(\{ queryKey: \["profilePolitical", ownerId\] \}\)/);
});
