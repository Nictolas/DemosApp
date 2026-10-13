const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const source = (name) => fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');

function between(src, start, end) {
  const s = src.indexOf(start);
  assert.notEqual(s, -1, `missing start marker: ${start}`);
  const e = src.indexOf(end, s + start.length);
  assert.notEqual(e, -1, `missing end marker: ${end}`);
  return src.slice(s, e);
}

test('manual Initiative proposal creation is disabled under official-Ministero model', () => {
  const src = source('iniziative-popolari.js');
  const block = between(src, "router.post('/', verifyToken", "// PUT /api/iniziative-popolari/:id");
  assert.match(block, /res\.status\(410\)/);
  assert.match(block, /PROPOSTA_MANUALE_DISABILITATA/);
  assert.match(block, /fonte ufficiale sincronizzata/);
});

test('legacy Initiative proposal bypass is disabled', () => {
  const src = source('iniziative-popolari.js');
  const block = between(src, "router.post('/richiesta', verifyToken", "// GET /api/iniziative-popolari/richieste");
  assert.match(block, /res\.status\(410\)/);
  assert.match(block, /Endpoint legacy disabilitato/);
  assert.doesNotMatch(block, /INSERT INTO iniziative_popolari/);
  assert.doesNotMatch(block, /userid, status, quorum/);
});

test('Initiative management transitions use capability-aware Admin checks', () => {
  const src = source('iniziative-popolari.js');
  assert.match(src, /router\.put\('\/:id', verifyToken, requireAdmin,/);
  assert.match(src, /router\.get\('\/richieste', verifyToken, requireAdmin,/);
  assert.match(src, /router\.post\('\/:id\/accetta', verifyToken, requireAdmin,/);
  assert.match(src, /router\.post\('\/:id\/rifiuta', verifyToken, requireAdmin,/);
  const del = between(src, "router.delete('/:id', verifyToken", "// POST /api/iniziative-popolari/vota");
  assert.match(del, /Boolean\(req\.user\?\.isAdmin\)/);
  assert.match(del, /String\(iniziativa\.userid\) === String\(userId\)/);
});

test('manual Referendum proposal creation is disabled under official-Ministero model', () => {
  const src = source('referendum-abrogativi.js');
  const block = between(src, "router.post('/', verifyToken", "// PUT /api/referendum-abrogativi/:id");
  assert.match(block, /res\.status\(410\)/);
  assert.match(block, /PROPOSTA_MANUALE_DISABILITATA/);
  assert.match(block, /fonte ufficiale sincronizzata/);
});

test('Referendum management transitions use capability-aware Admin checks', () => {
  const src = source('referendum-abrogativi.js');
  assert.match(src, /const \{ verifyToken, requireAdmin \} = require\('\.\.\/middleware\/auth'\)/);
  assert.match(src, /router\.put\('\/:id', verifyToken, requireAdmin,/);
  assert.match(src, /router\.post\('\/:id\/accetta', verifyToken, requireAdmin,/);
  assert.match(src, /router\.post\('\/:id\/rifiuta', verifyToken, requireAdmin,/);
  const del = between(src, "router.delete('/:id', verifyToken", "// POST /api/referendum-abrogativi/:id/accetta");
  assert.match(del, /Boolean\(req\.user\?\.isAdmin\)/);
  assert.match(del, /String\(referendum\.userid\) === String\(userId\)/);
});

test('manual user ICE creation is disabled under official-EU-source model', () => {
  const src = source('ice.js');
  assert.match(src, /function officialSourceOnly/);
  assert.match(src, /res\.status\(410\)/);
  assert.match(src, /ICE gestite dalla fonte ufficiale UE/);
  assert.match(src, /router\.post\('\/', verifyToken, officialSourceOnly\)/);
  assert.doesNotMatch(src, /INSERT INTO ice/);
  assert.doesNotMatch(src, /INSERT INTO voti_ice/);
});

test('ICE management remains Admin-only', () => {
  const src = source('ice.js');
  assert.match(src, /router\.get\('\/richieste', verifyToken, requireAdmin,/);
  assert.match(src, /router\.put\('\/:id', verifyToken, requireAdmin,/);
  assert.match(src, /router\.post\('\/:id\/:action', verifyToken, requireAdmin,/);
});
