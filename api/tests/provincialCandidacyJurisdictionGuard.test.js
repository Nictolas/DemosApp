'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { jurisdictionMatchesRepresentative } = require('../services/politicalEligibilityService');

test('provincial candidacy jurisdiction rejects contradictory or unknown office levels', () => {
  for (const [office, province, otherOffice] of [
    ['it.provincial.trento', 'TN', 'it.provincial.bolzano'],
    ['it.provincial.bolzano', 'BZ', 'it.provincial.trento'],
  ]) {
    const resident = { paese_residenza: 'IT', provincia_residenza: province };
    assert.equal(jurisdictionMatchesRepresentative({ province, level: office }, office, resident), true);
    assert.equal(jurisdictionMatchesRepresentative({ province, level: otherOffice }, office, resident), false);
    assert.equal(jurisdictionMatchesRepresentative({ province, level: 'CONSIGLIO_REGIONALE' }, office, resident), false);
    assert.equal(jurisdictionMatchesRepresentative({ province, level: 'UNKNOWN_OFFICE' }, office, resident), false);
    assert.equal(jurisdictionMatchesRepresentative({ province }, office, resident), true);
  }
});
