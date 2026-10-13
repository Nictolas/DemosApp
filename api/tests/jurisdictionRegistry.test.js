const test = require('node:test');
const assert = require('node:assert/strict');
const { JURISDICTIONS, validateJurisdictions } = require('../config/jurisdictions');
const civic = require('../config/civicProcesses');

test('jurisdictions are shared by civic and political domains', () => {
  assert.equal(civic.JURISDICTIONS, JURISDICTIONS);
  assert.equal(JURISDICTIONS.it.parentId, 'eu');
  assert.equal(JURISDICTIONS.us.name, 'Stati Uniti d’America');
});

test('shared jurisdiction hierarchy validates independently from domain adapters', () => {
  const validation = validateJurisdictions();
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});
