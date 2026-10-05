const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeResearchDatabaseError,
  withResearchDatabaseBoundary,
  RESEARCH_DATABASE_ERROR_MESSAGE
} = require('../config/researchDatabase');

test('Research database boundary replaces infrastructure errors with a stable secret-free error', async () => {
  const secret = '<REDACTED_API_KEY>';
  await assert.rejects(
    () => withResearchDatabaseBoundary(async () => {
      throw new Error(`connect failed postgresql://research:${secret}@db.example.test/research`);
    }),
    (error) => {
      assert.equal(error.message, RESEARCH_DATABASE_ERROR_MESSAGE);
      assert.equal(error.message.includes(secret), false);
      assert.equal(error.message.includes('postgresql://'), false);
      return true;
    }
  );
});

test('Research database sanitizer does not retain infrastructure error metadata', () => {
  const error = sanitizeResearchDatabaseError(new Error('host=db.internal password=secret'));
  assert.equal(error.message, RESEARCH_DATABASE_ERROR_MESSAGE);
  assert.equal(error.cause, undefined);
  assert.deepEqual(Object.keys(error), []);
});

test('Research database boundary rejects invalid operations fail-closed', async () => {
  await assert.rejects(
    () => withResearchDatabaseBoundary(null),
    (error) => error.message === RESEARCH_DATABASE_ERROR_MESSAGE
  );
});
