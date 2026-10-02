const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'research_public_political_vectors.sql'), 'utf8');

test('political vector projection has freshness, provenance and minimization constraints', () => {
  assert.match(sql, /source_snapshot_id text NOT NULL/i);
  assert.match(sql, /methodology_version text NOT NULL/i);
  assert.match(sql, /generated_at timestamptz NOT NULL/i);
  assert.match(sql, /expires_at timestamptz NOT NULL/i);
  assert.match(sql, /expires_at <= generated_at \+ interval '24 hours'/i);
  assert.match(sql, /REVOKE ALL .* FROM anon/i);
  assert.match(sql, /REVOKE ALL .* FROM authenticated/i);
  assert.doesNotMatch(sql, /\buser_id\b|\bemail\b|\baccount_id\b|\bsession_id\b/i);
});
