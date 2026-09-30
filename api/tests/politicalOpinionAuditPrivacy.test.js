const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldAuditPoliticalOpinionAccess
} = require('../middleware/auditMiddleware');

test('self access to political opinions is not identity-audited', () => {
  assert.equal(shouldAuditPoliticalOpinionAccess({
    requesterId: 'user-1',
    requesterRole: 'E',
    targetId: 'user-1'
  }), false);
});

test('ordinary access to a public political profile is not identity-audited', () => {
  assert.equal(shouldAuditPoliticalOpinionAccess({
    requesterId: 'user-1',
    requesterRole: 'E',
    targetId: 'politician-1'
  }), false);
});

test('admin cross-user political-opinion access is audited', () => {
  assert.equal(shouldAuditPoliticalOpinionAccess({
    requesterId: 'admin-1',
    requesterRole: 'AD',
    targetId: 'user-2'
  }), true);
});

test('admin self access is not treated as cross-user audit', () => {
  assert.equal(shouldAuditPoliticalOpinionAccess({
    requesterId: 'admin-1',
    requesterRole: 'AD',
    targetId: 'admin-1'
  }), false);
});
