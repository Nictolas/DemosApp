'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../docs/political-public-source-evidence-seven-20261029.json');
const { officialUrl, officialIdMatchesSource } = require('../utils/politicalIdentityCrosswalkAudit');

test('seven public institutional references are valid, unique, and unapproved', () => {
  assert.equal(registry.status, 'EVIDENCE_ONLY_UNMAPPED');
  assert.equal(registry.items.length, 7);
  const unique = new Set();
  for (const item of registry.items) {
    assert.ok(!unique.has(item.senato_official_id));
    unique.add(item.senato_official_id);
    assert.ok(/^[1-9][0-9]{0,9}$/.test(item.senato_official_id));
    assert.equal(officialUrl(item.senato_profile_url, 'SENATO'), true);
    assert.equal(officialIdMatchesSource({
      chamber: 'SENATO',
      official_id: item.senato_official_id,
      source_url: item.senato_profile_url
    }), true);
    assert.equal(item.identity_to_demos_user, 'NOT_VERIFIED');
    assert.equal(item.mandate_exact_dates, 'NOT_VERIFIED');
    assert.equal(item.approval_record, 'NOT_CREATED');
    assert.ok(item.camera_legislatures.length > 0);
    assert.ok(item.senato_legislatures.length > 0);
    assert.ok(item.camera_legislatures.every(n => Number.isInteger(n) && n > 0));
    assert.ok(item.senato_legislatures.every(n => Number.isInteger(n) && n > 0));
    assert.equal(new Set(item.camera_legislatures).size, item.camera_legislatures.length);
    assert.equal(new Set(item.senato_legislatures).size, item.senato_legislatures.length);
    assert.ok(item.camera_legislatures.every(n => !item.senato_legislatures.includes(n)),
      'one seat per chamber per legislature in this reviewed source batch');
    assert.equal('user_id' in item, false);
    assert.equal('starts_at' in item, false);
    assert.equal('ends_at' in item, false);
  }
});
