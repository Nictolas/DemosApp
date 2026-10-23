const test = require('node:test');
const assert = require('node:assert/strict');
const { isDpoGrantAllowed } = require('../utils/dpoAuthorization');
test('DPO requires an active, non-Admin account with a positive DPO grant', () => {
  assert.equal(isDpoGrantAllowed({ status:'a', is_dpo:true, is_admin:false }), true);
  assert.equal(isDpoGrantAllowed({ status:'a', is_dpo:true, is_admin:true }), false);
  assert.equal(isDpoGrantAllowed({ status:'a', is_dpo:false, is_admin:false }), false);
  assert.equal(isDpoGrantAllowed({ status:'i', is_dpo:true, is_admin:false }), false);
  assert.equal(isDpoGrantAllowed({ status:'a', is_dpo:'true', is_admin:false }), false);
  assert.equal(isDpoGrantAllowed(null), false);
});
