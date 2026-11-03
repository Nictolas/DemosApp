'use strict';

// Source-only privacy regression. No provider credentials, database connection,
// HTTP request, network access or external side effects.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const routes = [
  'api/routes/admin/axiom-migration.js',
  'api/routes/admin/backup.js',
  'api/routes/admin/data-retention.js',
  'api/routes/admin/data-export.js',
];
const read = route => fs.readFileSync(path.join(root, route), 'utf8');

test('legacy admin routes never log raw exception objects or their messages', () => {
  for (const route of routes) {
    const source = read(route);
    assert.doesNotMatch(source,
      /console\.(?:error|warn|log)\([^\n;]*,\s*(?:error|err|sdkErr|sdkQueryErr)(?:\.message)?\s*\)/,
      route + ': unredacted error object in console');
    assert.doesNotMatch(source,
      /console\.(?:error|warn|log)\([^\n;]*(?:error|err|sdkErr|sdkQueryErr)\.message/,
      route + ': raw exception message in console');
  }
});

test('legacy admin JSON responses and partial results do not expose exception messages', () => {
  for (const route of routes) {
    const source = read(route);
    assert.doesNotMatch(source,
      /\b(?:error|message|detail|details)\s*:\s*(?:error|err|sdkErr|sdkQueryErr)\.message\b/,
      route + ': raw provider/SQL error returned to caller');
    assert.doesNotMatch(source,
      /\$\{\s*(?:error|err|sdkErr|sdkQueryErr)\.message\s*\}/,
      route + ': interpolated provider/SQL exception');
  }
});

test('redacted export errors preserve distinct response fields', () => {
  const source = read('api/routes/admin/data-export.js');
  assert.doesNotMatch(source,
    /error:\s*'Errore [^']+',\s*error:\s*'Dettaglio non disponibile'/,
    'redaction must not overwrite an existing response error with a second key');
  assert.match(source,
    /error:\s*'Errore ottenendo analisi Axiom',\s*message:\s*'Dettaglio non disponibile'/);
  assert.match(source,
    /error:\s*'Errore ottenendo log centralizzati',\s*message:\s*'Dettaglio non disponibile'/);
});

test('GDPR holds remain in place; privileged endpoints retain Admin checks', () => {
  const backup = read('api/routes/admin/backup.js');
  const retention = read('api/routes/admin/data-retention.js');
  const migration = read('api/routes/admin/axiom-migration.js');
  const exported = read('api/routes/admin/data-export.js');
  assert.match(backup, /router\.use\(verifyToken\)/);
  assert.match(backup, /router\.use\(requireAdmin\)/);
  assert.match(backup, /return res\.status\(error\.statusCode \|\| 410\)/);
  assert.match(retention, /router\.use\(requireAdmin\)/);
  assert.match(retention, /res\.status\(410\)\.json/);
  assert.match(migration, /res\.status\(410\)\.json/);
  assert.match(migration, /verifyToken, requireAdmin/);
  assert.match(exported, /router\.use\(verifyToken, requireAdmin\)/);
});
