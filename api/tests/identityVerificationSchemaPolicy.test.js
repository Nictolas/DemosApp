const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '..', 'database', 'create-identity-verifications-table.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

test('identity schema enforces one account per person and one person per account', () => {
  assert.match(schema, /user_id\s+UUID\s+UNIQUE\s+REFERENCES\s+users\(id\)\s+ON DELETE SET NULL/i);
  assert.match(schema, /person_key\s+VARCHAR\(64\)\s+NOT NULL\s+UNIQUE/i);
});

test('identity schema persists only pseudonymous person key, not fiscal number', () => {
  assert.doesNotMatch(schema, /^\s*(fiscal_number|fiscalNumber|codice_fiscale)\s+/im);
  assert.match(schema, /person_key/);
});

test('account deletion detaches user id without automatically deleting anti-duplicate person key', () => {
  assert.match(schema, /ON DELETE SET NULL/i);
  assert.match(schema, /retention_until\s+TIMESTAMPTZ/i);
  assert.match(schema, /retention.*DPIA/i);
});
