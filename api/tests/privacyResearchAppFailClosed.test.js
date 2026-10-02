const test = require('node:test');
const assert = require('node:assert/strict');

test('research app boots with public Research API fail-closed', () => {
  const app = require('../research-app');
  assert.equal(app.locals.researchProductionMount.mounted, false);
  assert.equal(app.locals.researchProductionMount.blockers.includes('productionApprovalRecorded'), true);
  assert.equal(app.locals.researchProductionMount.blockers.includes('researchDatabaseConfigured'), true);
});
