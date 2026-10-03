const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const overlayPath = path.join(
  __dirname,
  '../../supabase/schemas/privacy_first_research_renewal_proof_shadow.sql'
);

test('renewal proof shadow overlay permits only the documented proof purposes', () => {
  const sql = fs.readFileSync(overlayPath, 'utf8');

  assert.match(sql, /purpose\s+in\s*\(\s*'read-opinions-v1'\s*,\s*'renew-participant-v1'\s*\)/i);
  assert.doesNotMatch(sql, /participant_id|account_id|user_id|email/i);
});
