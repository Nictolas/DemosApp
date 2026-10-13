const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('civic schema stores only the minimal Staff-reviewed realization evidence', () => {
  const sql = read('20261009_civic_processes.sql');
  assert.match(sql, /realized BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(sql, /realized_law_reference TEXT/);
  assert.match(sql, /realized_verified_at TIMESTAMPTZ/);
  assert.match(sql, /realized_verified_by_user_id UUID REFERENCES users\(id\)/);
  assert.match(sql, /CHECK \(NOT realized OR/);
});

test('priority reads exclude only processes Staff marked as realized', () => {
  const src = read('api/services/civicProcessReadService.js');
  const matches = src.match(/COALESCE\(cp\.realized, false\) = false/g) || [];
  assert.equal(matches.length, 2);
  assert.doesNotMatch(src, /canonical_stage.*closed.*priority/i);
});

test('realization endpoint is Admin-only, requires a law reference and is reversible', () => {
  const route = read('api/routes/admin/civic-processes.js');
  assert.match(route, /router\.use\(verifyToken\)/);
  assert.match(route, /router\.use\(requireAdmin\)/);
  assert.match(route, /router\.patch\('\/:processId\/realization'/);
  assert.match(route, /LAW_REFERENCE_REQUIRED/);
  assert.match(route, /realized_law_reference = CASE WHEN \$2 THEN \$3 ELSE NULL END/);
  assert.match(route, /realized_verified_at = CASE WHEN \$2 THEN NOW\(\) ELSE NULL END/);
  assert.match(route, /realized_verified_by_user_id = CASE WHEN \$2 THEN \$4::uuid ELSE NULL END/);
});

test('realization endpoint is mounted behind the existing admin rate limiter', () => {
  const app = read('api/app.js');
  assert.match(app, /civicProcessAdminRoutes = require\('\.\/routes\/admin\/civic-processes'\)/);
  assert.match(app, /app\.use\('\/api\/admin\/civic-processes', adminLimiter, civicProcessAdminRoutes\)/);
});
