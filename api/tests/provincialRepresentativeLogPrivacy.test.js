'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'rappresentanti.js'), 'utf8');
const start = source.indexOf('// GET /api/rappresentanti/disponibili');
const end = source.indexOf('// GET /api/rappresentanti -', start);
assert.ok(start >= 0 && end > start);
const availability = source.slice(start, end);

test('representative matching endpoint must not log political identifiers, scores or SQL internals', () => {
  assert.doesNotMatch(availability, /console\.(?:log|warn|error|dir)\s*\(/);
  assert.doesNotMatch(availability, /details:\s*error\.(?:message|detail|stack)/);
  assert.match(availability, /error:\s*'Errore nel recuperare rappresentanti disponibili'/);
});

test('representative matching retains authentication, provincial release gate and selection eligibility', () => {
  assert.match(availability, /router\.get\('\/disponibili', verifyToken/);
  assert.match(availability, /if \(!isPoliticalOfficeVisible\(office\)\)/);
  assert.match(availability, /await listEligibleRepresentatives\(pool, userId, grado_elezione\)/);
  assert.match(availability, /await buildPoliticalMatches\(/);
});
