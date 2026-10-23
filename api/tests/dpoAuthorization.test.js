const test = require('node:test');
const assert = require('node:assert/strict');
const { isDpoGrantAllowed, isPrivacyOverviewAccessAllowed } = require('../utils/dpoAuthorization');
test('DPO requires an active, non-Admin account with a positive DPO grant', () => {
  assert.equal(isDpoGrantAllowed({ status:'a', is_dpo:true, is_admin:false }), true);
  assert.equal(isDpoGrantAllowed({ status:'a', is_dpo:true, is_admin:true }), false);
  assert.equal(isDpoGrantAllowed({ status:'a', is_dpo:false, is_admin:false }), false);
  assert.equal(isDpoGrantAllowed({ status:'i', is_dpo:true, is_admin:false }), false);
  assert.equal(isDpoGrantAllowed({ status:'a', is_dpo:'true', is_admin:false }), false);
  assert.equal(isDpoGrantAllowed(null), false);
});

test('aggregate privacy overview allows active Admin or active DPO, not ordinary users', () => {
  assert.equal(isPrivacyOverviewAccessAllowed({ status: 'a', is_admin: true, is_dpo: false }), true);
  assert.equal(isPrivacyOverviewAccessAllowed({ status: 'a', is_admin: false, is_dpo: true }), true);
  assert.equal(isPrivacyOverviewAccessAllowed({ status: 'a', is_admin: false, is_dpo: false }), false);
  assert.equal(isPrivacyOverviewAccessAllowed({ status: 'i', is_admin: true, is_dpo: false }), false);
  assert.equal(isPrivacyOverviewAccessAllowed({ status: 'a', is_admin: 'true', is_dpo: false }), false);
  assert.equal(isPrivacyOverviewAccessAllowed({ status: 'a', is_admin: false, is_dpo: 'true' }), false);
  assert.equal(isPrivacyOverviewAccessAllowed(null), false);
  assert.equal(isDpoGrantAllowed({ status: 'a', is_admin: true, is_dpo: false }), false);
});
