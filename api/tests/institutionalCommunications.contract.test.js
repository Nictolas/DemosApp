const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'comunicazioni.js'),
  'utf8'
);
const migrationSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '20261009_institutional_vote_communications.sql'),
  'utf8'
);

test('institutional vote publication remains authenticated and Politico/Admin gated', () => {
  assert.match(routeSource, /router\.post\('\/'\s*,\s*verifyToken\s*,\s*async\s*\(req,\s*res\)/);
  assert.match(routeSource, /!req\.user\?\.isPolitician\s*&&\s*!req\.user\?\.isAdmin/);
});

test('institutional vote author is resolved server-side from the authenticated request', () => {
  assert.match(
    routeSource,
    /const\s+\{\s*targetUserId\s*,\s*level\s*\}\s*=\s*await\s+resolveInstitutionalCommunicationTarget\(req\s*,\s*livello\s*\)/
  );
  assert.match(routeSource, /\[\s*targetUserId\s*,\s*String\(titolo\)\.trim\(\)/s);
});

test('institutional votes keep a deterministic key and atomic dedup upsert', () => {
  assert.match(routeSource, /buildInstitutionalVoteKey\s*\(\s*\{/);
  assert.match(routeSource, /ON\s+CONFLICT\s*\(id_utente\s*,\s*institutional_vote_key\)/i);
  assert.match(routeSource, /WHERE\s+institutional_vote_key\s+IS\s+NOT\s+NULL/i);
});

test('migration preserves the schema invariants required by Comunica', () => {
  for (const column of [
    'tipo',
    'institutional_level',
    'vote_date',
    'source_vote_id',
    'institutional_vote_key'
  ]) {
    assert.match(
      migrationSource,
      new RegExp(`ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${column}\\b`, 'i')
    );
  }

  assert.match(migrationSource, /comunicazioni_institutional_level_check/);
  assert.match(migrationSource, /uq_comunicazioni_politician_vote_key/);
  assert.match(migrationSource, /idx_comunicazioni_transparency_window/);
});
