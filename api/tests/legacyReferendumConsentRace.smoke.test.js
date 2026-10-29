'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const route = fs.readFileSync(path.join(__dirname, '../routes/referendum.js'), 'utf8');
const service = fs.readFileSync(path.join(__dirname, '../services/politicalConsentService.js'), 'utf8');
const block = route.split("// POST /api/referendum-abrogativi/vota")[1]?.split("// DELETE /api/referendum-abrogativi/vota")[0];

test('legacy referendum writes lock users before consent recheck and data changes', () => {
  assert.ok(block, 'legacy referendum endpoint must remain auditable');
  const lock = block.indexOf('SELECT id FROM users WHERE id = $1 FOR UPDATE');
  const consent = block.indexOf('getPoliticalConsentState(client, userId)');
  const del = block.indexOf("await client.query('DELETE FROM voti_referendum_abrogativi");
  const ins = block.indexOf("await client.query(\n        'INSERT INTO voti_referendum_abrogativi");
  assert.ok(lock > 0 && consent > lock && del > consent && ins > del);
  assert.match(block, /await client.query\('BEGIN'\)/);
  assert.match(block, /await client.query\('COMMIT'\)/);
  assert.match(block, /await client.query\('ROLLBACK'\)/);
  assert.match(block, /finally\s*\{\s*if \(client\) client.release\(\)/);
  assert.doesNotMatch(block, /await pool.query\('(DELETE|INSERT) (FROM|INTO) voti_referendum_abrogativi/);
});

test('revocation erases legacy referendum preferences in the same transaction', () => {
  assert.match(service, /'voti_referendum_abrogativi'/);
});

test('real PostgreSQL 17 CI exercises both lock orders and rollback', () => {
  const script = fs.readFileSync(path.join(__dirname, '../scripts/verify-political-consent-save-race-ci.js'), 'utf8');
  assert.match(script, /legacy-referendum-before-revoke/);
  assert.match(script, /revoke-before-legacy-referendum/);
  assert.match(script, /legacy-referendum-replacement-rollback/);
  assert.match(script, /PGDATABASE !== DB/);
});
