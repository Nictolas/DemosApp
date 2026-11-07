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

test('provincial mandate and candidacy jurisdiction rejects simultaneous conflicting province fields', () => {
  for (const [office, province, equivalent, foreignProvince] of [
    ['it.provincial.trento', 'TN', 'Trento', 'BZ'],
    ['it.provincial.bolzano', 'BZ', 'Bozen', 'TN'],
  ]) {
    const resident = { paese_residenza: 'IT', provincia_residenza: province };
    assert.equal(jurisdictionMatchesRepresentative(
      { province, provincia: equivalent, level: office }, office, resident
    ), true, 'equivalent aliases are permitted');
    assert.equal(jurisdictionMatchesRepresentative(
      { province, provincia: foreignProvince, level: office }, office, resident
    ), false, 'another province cannot piggyback on one valid field');
    assert.equal(jurisdictionMatchesRepresentative(
      { province: foreignProvince, admin2: province, level: office }, office, resident
    ), false, 'admin2/province conflict is also rejected');
    assert.equal(jurisdictionMatchesRepresentative(
      { province, county: 'PI', level: office }, office, resident
    ), false, 'a third province alias cannot override residence');
    assert.equal(jurisdictionMatchesRepresentative(
      { level: office }, office, resident
    ), false, 'missing province remains ineligible');
  }
});
