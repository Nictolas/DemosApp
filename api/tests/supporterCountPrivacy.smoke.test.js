const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const supporters = fs.readFileSync(path.join(ROOT, 'api', 'routes', 'sostenitori.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'Sostenitori.tsx'), 'utf8');

function between(source, start, end) {
  const s = source.indexOf(start);
  assert.notEqual(s, -1, `missing ${start}`);
  const e = source.indexOf(end, s + start.length);
  assert.notEqual(e, -1, `missing ${end}`);
  return source.slice(s, e);
}

test('public total endpoint exposes only activist/organization counts', () => {
  const block = between(
    supporters,
    "router.get('/totale', async",
    "// GET /api/sostenitori/totale-privato",
  );
  assert.match(block, /getPublicSupportCounts/);
  assert.match(block, /politico: null/);
  assert.match(block, /candidato: null/);
  assert.match(block, /restricted: \{ politico: true, candidato: true \}/);
  assert.doesNotMatch(block, /getPrivatePoliticalSupportCounts/);
});

test('private political totals require authentication and owner/Admin authorization', () => {
  const block = between(
    supporters,
    "router.get('/totale-privato', verifyToken",
    '\nmodule.exports = router;',
  );
  assert.match(block, /String\(req\.userId\) !== String\(sostenuto_id\)/);
  assert.match(block, /req\.user\?\.isAdmin/);
  assert.doesNotMatch(block, /req\.userRole/);
  assert.match(block, /getPrivatePoliticalSupportCounts/);
});

test('candidate private count uses all five current candidate selections, not legacy users.candidati', () => {
  const helper = between(
    supporters,
    'async function getPrivatePoliticalSupportCounts',
    '// GET /api/sostenitori/totale - Vista pubblica',
  );
  for (const field of [
    'candidato_europeo',
    'candidato_camera',
    'candidato_senato',
    'candidato_regionale',
    'candidato_comune',
  ]) {
    assert.match(helper, new RegExp(field));
  }
  assert.doesNotMatch(helper, /WHERE candidati =/);
});

test('own supporters page uses the private aggregate endpoint', () => {
  assert.match(ui, /\/api\/sostenitori\/totale-privato\?sostenuto_id=\$\{user\.id\}/);
  assert.doesNotMatch(ui, /\/api\/sostenitori\/totale\?sostenuto_id=\$\{user\.id\}/);
});
