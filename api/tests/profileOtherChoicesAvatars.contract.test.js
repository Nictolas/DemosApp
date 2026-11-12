const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const read = name => readFileSync(resolve(__dirname,'../..',name),'utf8');

test('selected portraits use one existing owner query and at most one public batch lookup',()=>{
  const route = read('api/routes/user/profile-selections.js');
  assert.match(route,/router\.get\('\/', verifyToken, requirePoliticalConsent/);
  assert.match(route,/WHERE u\.id = \$1/);
  assert.match(route,/LEFT JOIN users a ON a\.id = u\.attivisti/);
  assert.match(route,/LEFT JOIN users o ON o\.id = u\.organizzazioni/);
  assert.match(route,/to_jsonb\(a\)->'avatar_config'/);
  assert.match(route,/to_jsonb\(o\)->'avatar_config'/);
  assert.match(route,/loadGovernmentVoteAvatars\(pool, selection\.capo_stato \|\| \[\]\)/);
  assert.match(route,/version: 4/);
  assert.match(route,/capoStatoAvatars,/);
  assert.match(route,/attivistaAvatar: parseExistingAvatar\(selection\.attivista_avatar_config\)/);
  assert.match(route,/organizzazioneAvatar: parseExistingAvatar\(selection\.organizzazione_avatar_config\)/);
});

test('Grazia portraits remain Admin only, behind existing publication filter',()=>{
  const route = read('api/routes/user/profile-selections.js');
  assert.match(route,/\(\$2::boolean OR EXISTS/);
  assert.match(route,/gc\.attivo = TRUE AND gc\.pubblicato = TRUE/);
  assert.match(route,/const isAdmin = req\.user\?\.isAdmin === true/);
  assert.match(route,/if \(isAdmin && selection\.grazia\?\.length\)/);
  assert.match(route,/public\.grazia_avatar_configs/);
  assert.match(route,/parseGraziaAvatarConfig/);
  const component=read('client/src/pages/Profilo/components/ProfileChosenPreferences.tsx');
  assert.match(component,/if \(key === "grazia"\) return canViewRestrictedAvatars/);
  assert.match(read('client/src/pages/Profilo/index.tsx'),/canViewRestrictedAvatars=\{hasAdminCapability\(user\)\}/);
});

test('only real avatar configs render at 24px before names and never on legal proposal rows',()=>{
  const component=read('client/src/pages/Profilo/components/ProfileChosenPreferences.tsx');
  assert.match(component,/import \{ CustomAvatar \} from/);
  assert.match(component,/size=\{24\}/);
  assert.match(component,/data-testid="profile-other-choice-avatar"/);
  assert.match(component,/if \(key === "attivista"\) return choices\?\.attivistaAvatar/);
  assert.match(component,/if \(key === "organizzazione"\) return choices\?\.organizzazioneAvatar/);
  assert.match(component,/return null; \/\/ Amnesty and initiatives/);
  assert.ok(component.indexOf('<CustomAvatar') < component.indexOf('{value}</span>'));
  assert.doesNotMatch(component,/\bfetch\s*\(|apiRequest\s*\(|useQuery\s*\(/);
});

test('encrypted cache refreshes older choices once and retains consent controls',()=>{
  const hook=read('client/src/pages/Profilo/hooks/useProfileData.ts');
  const vault=read('client/src/pages/Profilo/utils/encryptedProfileVault.ts');
  assert.match(vault,/version\?: 4;/);
  assert.match(hook,/snapshot\.preferences\?\.version !== 4/);
  assert.match(hook,/legacyInitiativeId \|\| snapshot\.preferences\?\.version !== 4/);
  assert.match(hook,/const politicalAllowed = ownProfile && vaultReady && consentVerified/);
  assert.match(hook,/enabled: enabled && vaultReady && politicalAllowed,/);
  assert.match(hook,/patchEncryptedProfile\(ownerId, \{ preferences: value \}, \{ preferences: revision \}\)/);
});
