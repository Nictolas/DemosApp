const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../services/accountCapabilitiesService.js'), 'utf8');

test('canonical politician and candidate gates ignore LEGACY_BACKFILL source', () => {
  assert.match(sql, /pc\.source <> 'LEGACY_BACKFILL'/);
  assert.match(sql, /pm\.source <> 'LEGACY_BACKFILL'/);
  assert.match(sql, /pm\.starts_at <= NOW\(\)/);
  assert.match(sql, /pc\.starts_at <= NOW\(\)/);
});
