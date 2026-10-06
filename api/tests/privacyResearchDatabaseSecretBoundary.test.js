const test = require('node:test');
const assert = require('node:assert/strict');

const { parseResearchDatabaseUrl } = require('../config/researchDatabase');

test('Research database URL validation errors never echo connection secrets', () => {
  const secret = 'E405_SENTINEL_SECRET';
  const invalidUrls = [
    `https://research:${secret}@db.example.test/research`,
    `postgresql://research:${secret}@db.example.test/research#fragment`,
    `postgresql://research:${secret}@db.example.test/research?options=unsafe`
  ];

  for (const value of invalidUrls) {
    assert.throws(
      () => parseResearchDatabaseUrl(value),
      (error) => {
        assert.equal(error.message.includes(secret), false);
        assert.equal(error.message.includes(value), false);
        return true;
      }
    );
  }
});
