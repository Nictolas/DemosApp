'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ACCOUNT_TYPES, ACCOUNT_TYPE_CODES, normalizeAccountType, normalizeNewModelRow, deriveLegacyRole } = require('../services/accountCapabilitiesService');

test('P/O/E are distinct account-type codes (not legacy role codes)', () => {
  assert.deepEqual(ACCOUNT_TYPE_CODES, { PERSON: 'P', ORGANIZATION: 'O', INSTITUTION: 'E' });
  for (const [name, code] of Object.entries(ACCOUNT_TYPE_CODES)) {
    assert.equal(normalizeAccountType(code), ACCOUNT_TYPES[name]);
    assert.equal(normalizeAccountType(name), ACCOUNT_TYPES[name]);
  }
});

test('legacy role projection uses the account type domain and never maps person P to politician', () => {
  assert.equal(deriveLegacyRole({ accountType: 'P' }), 'E');
  assert.equal(deriveLegacyRole({ accountType: 'E' }), 'I');
  assert.equal(deriveLegacyRole({ accountType: 'O' }), 'O');
  assert.equal(deriveLegacyRole({ accountType: 'P', isPolitician: true }), 'P');
});

test('new storage codes normalize to descriptive public capabilities', () => {
  const original = { id: 'synthetic', status: 'a', is_admin: false, is_activist: false, is_politician: false, is_candidate: false };
  assert.equal(normalizeNewModelRow({ ...original, account_type: 'P' }).capabilities.accountType, 'PERSON');
  assert.equal(normalizeNewModelRow({ ...original, account_type: 'O' }).capabilities.accountType, 'ORGANIZATION');
  assert.equal(normalizeNewModelRow({ ...original, account_type: 'E' }).capabilities.accountType, 'INSTITUTION');
});
