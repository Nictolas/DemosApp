const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', 'routes');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

for (const name of ['iniziative-popolari.js', 'referendum-abrogativi.js']) {
  test(`${name} does not expose SQL/debug payloads or raw request objects`, () => {
    const src = read(name);
    assert.doesNotMatch(src, /debug:\s*debugInfo/);
    assert.doesNotMatch(src, /const debugInfo\s*=/);
    assert.doesNotMatch(src, /console\.log\([^\n]*req\.headers/);
    assert.doesNotMatch(src, /console\.log\([^\n]*req\.body/);
    assert.doesNotMatch(src, /console\.log\([^\n]*req\.user\b/);
    assert.match(src, /if \(process\.env\.NODE_ENV !== 'production'\) console\.log/);
  });
}

test('Referendum ranking no longer references debug vote rows before initialization', () => {
  const src = read('referendum-abrogativi.js');
  assert.doesNotMatch(src, /debugVotiResult/);
});

test('Referendum canonical collection is simple and has no ranking diagnostics', () => {
  const src = read('referendum-abrogativi.js');
  const start = src.indexOf("router.get('/', async (req, res) => {");
  const end = src.indexOf('// POST /api/referendum-abrogativi -', start);
  const block = src.slice(start, end);
  assert.match(block, /buildQueryForTipo\('referendum', null, null, false, true\)/);
  assert.doesNotMatch(block, /debugQuery|testQuery|classifica\s*:|voti_referendum_abrogativi/);
});
