const test = require('node:test');
const assert = require('node:assert/strict');
const { isDpoGrantAllowed } = require('../utils/dpoAuthorization');

test('DPO permissions matrix is deny-by-default', () => {
  const cases = [
    [{ status: 'a', is_dpo: true, is_admin: false }, true],
    [{ status: 'a', is_dpo: true, is_admin: true }, false],
    [{ status: 'i', is_dpo: true, is_admin: false }, false],
    [{ status: 'a', is_dpo: false, is_admin: false }, false],
    [{ status: 'a', is_dpo: 'true', is_admin: false }, false],
    [null, false]
  ];
  for (const [value, expected] of cases) assert.equal(isDpoGrantAllowed(value), expected);
});
