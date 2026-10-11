'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const catalog = fs.readFileSync(path.join(ROOT, 'docs', 'PRODUCT_FEATURE_CATALOG.md'), 'utf8');
const requirements = fs.readFileSync(path.join(ROOT, 'docs', 'FUNCTIONAL_REQUIREMENTS.md'), 'utf8');

function ids(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[0]);
}

test('every catalogued user function has at least one functional requirement', () => {
  const catalogIds = [...new Set(ids(catalog, /UF-\d{3}/g))].sort();
  assert.equal(catalogIds.length, 66, `expected 66 canonical user functions, found ${catalogIds.length}`);
  const missing = catalogIds.filter((id) => !requirements.includes(id));
  assert.deepEqual(missing, [], `functions without requirement coverage: ${missing.join(', ')}`);
});

test('functional requirement identifiers are unique and substantial', () => {
  const requirementIds = ids(requirements, /RF-\d{3}/g);
  const uniqueIds = [...new Set(requirementIds)];
  assert.equal(requirementIds.length, uniqueIds.length, 'duplicate RF identifiers found');
  assert.ok(uniqueIds.length >= 70, `expected at least 70 functional requirements, found ${uniqueIds.length}`);
});

test('every UF reference in requirements points to a catalogued user function', () => {
  const catalogIds = new Set(ids(catalog, /UF-\d{3}/g));
  const references = [...new Set(ids(requirements, /UF-\d{3}/g))];
  const unknown = references.filter((id) => !catalogIds.has(id));
  assert.deepEqual(unknown, [], `unknown function references: ${unknown.join(', ')}`);
});

test('requirements use normative language and preserve key product invariants', () => {
  assert.match(requirements, /\bDEVE\b/);
  assert.match(requirements, /\bNON DEVE\b/);
  assert.match(requirements, /CIE prima dell'account personale/);
  assert.match(requirements, /meno di 10 risposte valide/);
  assert.match(requirements, /24 ore/);
  assert.match(requirements, /OFFICIAL/);
  assert.match(requirements, /Opinioni di un cittadino ordinario DEVONO restare private/);
});

test('functional document explicitly delegates non-functional system requirements to F12-03', () => {
  assert.match(requirements, /requisiti di sistema, infrastruttura, disponibilità, prestazioni e sicurezza trasversale appartengono a F12-03/);
  assert.match(requirements, /spostato nel documento F12-03/);
});
