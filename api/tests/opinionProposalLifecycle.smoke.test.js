const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('opinion proposal limit is enforced atomically on the user row', () => {
  const src = read('api/routes/opinioni-proposte.js');
  assert.match(src, /SELECT opinione_proposta_id FROM users WHERE id = \$1 FOR UPDATE/);
  assert.match(src, /PROPOSTA_PENDENTE_ESISTENTE/);
  assert.match(src, /UPDATE users SET opinione_proposta_id = \$1 WHERE id = \$2[\s\S]*COMMIT/);
});

test('proposal slot is released when a pending proposal becomes an official opinion', () => {
  const src = read('api/routes/opinioni/management.js');
  assert.match(src, /wasPending && !mappedGradi\.includes\('da approvare'\)/);
  assert.match(src, /UPDATE users SET opinione_proposta_id = NULL WHERE opinione_proposta_id = \$1/);
});

test('opinion management mutations and proposal queue are Admin-only', () => {
  const src = read('api/routes/opinioni/management.js');
  assert.match(src, /const \{ verifyToken, requireAdmin \} = require\('\.\.\/\.\.\/middleware\/auth'\)/);
  assert.match(src, /router\.get\('\/proposte', verifyToken, requireAdmin,/);
  assert.match(src, /router\.post\('\/', verifyToken, requireAdmin,/);
  assert.match(src, /router\.put\('\/:id', verifyToken, requireAdmin,/);
  assert.match(src, /router\.delete\('\/:id', verifyToken, requireAdmin,/);
});

test('promotion also closes the optional separate opinioni_proposte source', () => {
  const src = read('api/routes/opinioni/management.js');
  assert.match(src, /SELECT id FROM opinioni_proposte WHERE id = \$1/);
  assert.match(src, /existedInProposalTable/);
  assert.match(src, /DELETE FROM opinioni_proposte WHERE id = \$1/);
  assert.match(src, /closesPendingProposal/);
});
