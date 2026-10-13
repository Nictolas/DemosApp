const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const files = {
  capo: read('api/routes/capo-stato.js'),
  governo: read('api/routes/governo.js'),
  ministro: read('api/routes/governo-ministro.js'),
  grazia: read('api/routes/grazia.js'),
  amnistia: read('api/routes/amnistia.js'),
  iniziative: read('api/routes/iniziative-popolari.js'),
};

const migration = read('20261009_preference_cooldowns.sql');
const erasure = read('api/services/privacyErasureLedgerService.js');

function routeBlock(source, start, end) {
  const s = source.indexOf(start);
  assert.notEqual(s, -1, `missing start marker ${start}`);
  const e = source.indexOf(end, s + start.length);
  assert.notEqual(e, -1, `missing end marker ${end}`);
  return source.slice(s, e);
}

test('all F12-25 backend surfaces use the shared cooldown service and no weekly literals remain', () => {
  for (const [name, source] of Object.entries(files)) {
    assert.match(source, /preferenceCooldownService/, `${name} should import the shared service`);
    assert.doesNotMatch(source, /INTERVAL\s+'7 days'|7 giorni|settimanal|una volta a settimana/i, name);
  }
});

test('cooldown migration stores only user, scope and one current timestamp', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS preference_change_cooldowns/);
  assert.match(migration, /user_id TEXT NOT NULL/);
  assert.match(migration, /scope TEXT NOT NULL/);
  assert.match(migration, /last_changed_at TIMESTAMPTZ NOT NULL/);
  assert.match(migration, /PRIMARY KEY \(user_id, scope\)/);
  assert.doesNotMatch(migration, /choice|value|vote|history|payload/i);
});

test('privacy erasure explicitly removes preference cooldown rows', () => {
  assert.match(erasure, /\['preference_change_cooldowns', 'user_id'\]/);
});

test('Capo di Stato preference and consent have independent scopes and no-op detection', () => {
  assert.match(files.capo, /scope: 'capo-stato:preferenza'/);
  assert.match(files.capo, /scope: 'capo-stato:consenso'/);
  assert.match(files.capo, /requestedVote !== currentVote/);
  assert.match(files.capo, /current\?\.risposta === risposta/);
  assert.match(files.capo, /recordPreferenceChange\(client, \{ userId, scope: 'capo-stato:preferenza' \}\)/);
  assert.match(files.capo, /recordPreferenceChange\(client, \{ userId, scope: 'capo-stato:consenso' \}\)/);
});

test('Government minister cooldown is scoped per single ministry and unchanged values are no-ops', () => {
  assert.match(files.ministro, /scope: `governo:\$\{categoria\}`/);
  assert.match(files.ministro, /samePreference/);
  assert.match(files.ministro, /recordPreferenceChange\(client, \{ userId, scope: `governo:\$\{categoria\}` \}\)/);

  assert.match(files.governo, /const changes = \[\]/);
  assert.match(files.governo, /Object\.prototype\.hasOwnProperty\.call\(voti, ministero\)/);
  assert.match(files.governo, /scope: `governo:\$\{ministero\}`/);
  assert.match(files.governo, /blocchi\[ministero\]/);
  assert.match(files.governo, /scope: 'governo:consenso'/);
});

test('Grazia and Amnistia record removals in the same durable scope', () => {
  assert.match(files.grazia, /scope: 'grazia:preferenza'/);
  assert.match(files.grazia, /requestedVote === currentVote/);
  assert.match(files.grazia, /recordPreferenceChange\(client, \{ userId, scope: 'grazia:preferenza' \}\)/);

  const amnistiaPost = routeBlock(files.amnistia, "router.post('/vota'", "// DELETE /api/amnistia/vota");
  const amnistiaDelete = routeBlock(files.amnistia, "router.delete('/vota'", "// POST /api/amnistia -");
  assert.match(amnistiaPost, /scope: 'amnistia:preferenza'/);
  assert.match(amnistiaDelete, /scope: 'amnistia:preferenza'/);
  assert.match(amnistiaPost, /recordPreferenceChange/);
  assert.match(amnistiaDelete, /recordPreferenceChange/);
});

test('Iniziative canonical priority uses the same 24h durable scope for create/change/delete', () => {
  const generic = routeBlock(files.iniziative, "router.delete('/:id'", "// POST /api/iniziative-popolari/vota");
  const post = routeBlock(files.iniziative, "router.post('/vota'", "// DELETE /api/iniziative-popolari/vota");
  const del = routeBlock(files.iniziative, "router.delete('/vota'", "// GET /api/iniziative-popolari/debug");
  assert.match(generic, /async \(req, res, next\)/);
  assert.match(generic, /if \(id === 'vota'\) return next\(\)/);
  assert.match(post, /scope: 'iniziative-popolari:preferenza'/);
  assert.match(post, /assertPreferenceChangeAllowed/);
  assert.match(post, /recordPreferenceChange/);
  assert.match(post, /existingVote[\s\S]*=== selectedId[\s\S]*unchanged: true/);
  assert.match(del, /scope: 'iniziative-popolari:preferenza'/);
  assert.match(del, /recordPreferenceChange/);
});

test('active client copy no longer tells users to wait seven days', () => {
  const activeClientFiles = [
    'client/src/pages/CapodiStato/components/BlockedWarning.tsx',
    'client/src/pages/CapodiStato/components/ConsensoSection.tsx',
    'client/src/pages/Governo/components/ConsensoGovernoSection.tsx',
  ].map(read).join('\n');
  assert.doesNotMatch(activeClientFiles, /7 giorni|questa settimana|una settimana/i);
  assert.match(activeClientFiles, /24 ore/);
});
