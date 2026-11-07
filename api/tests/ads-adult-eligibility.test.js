'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isConfirmedAdultForAds } = require('../utils/adsAdultEligibility');

const now = new Date('2026-11-02T12:00:00Z');

test('conservatively excludes everyone who might be under 18', () => {
  for (const year of ['2026','2010','2009','2008']) {
    assert.equal(isConfirmedAdultForAds(year, now), false, year);
  }
  assert.equal(isConfirmedAdultForAds('2007', now), true);
  assert.equal(isConfirmedAdultForAds('2000', now), true);
});

test('supports date and year inputs without assuming an unknown birthday', () => {
  assert.equal(isConfirmedAdultForAds(new Date('2007-12-31T00:00:00Z'), now), true);
  assert.equal(isConfirmedAdultForAds('2008-01-01', now), false);
  assert.equal(isConfirmedAdultForAds('31/12/2007', now), true);
  assert.equal(isConfirmedAdultForAds('01/01/2008', now), false);
});

test('missing or invalid years never authorize advertising', () => {
  for (const input of [null,undefined,'','not recorded','1/1/???','1800','2100',
                        '2007-XX-XX','2007abc', {},new Date('bad')]) {
    assert.equal(isConfirmedAdultForAds(input, now), false, String(input));
  }
});

test('fails closed at the calendar-year boundary, never authorizes age 18 from year alone', () => {
  assert.equal(isConfirmedAdultForAds('2008', new Date('2026-12-31T23:59:59Z')), false);
  assert.equal(isConfirmedAdultForAds('2008', new Date('2027-01-01T00:00:00Z')), true);
  assert.equal(isConfirmedAdultForAds('2008', new Date('2026-01-01T00:00:00Z')), false);
  assert.equal(isConfirmedAdultForAds('2007', new Date(NaN)), false);
});
