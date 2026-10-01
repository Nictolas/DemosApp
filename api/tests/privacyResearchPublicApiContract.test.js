const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  RESEARCH_PUBLIC_ENDPOINTS,
  assertResearchPublicPayload
} = require('../services/researchPublicApiContract');

test('Research public API contract exposes only pseudonymous proof material and opinions', () => {
  assert.deepEqual(RESEARCH_PUBLIC_ENDPOINTS.issueChallenge.requestKeys, []);
  assert.deepEqual(RESEARCH_PUBLIC_ENDPOINTS.issueChallenge.responseKeys, ['challenge', 'purpose']);
  assert.deepEqual(
    RESEARCH_PUBLIC_ENDPOINTS.readOpinionVector.requestKeys,
    ['participantPublicKey', 'challenge', 'signature']
  );
  assert.deepEqual(RESEARCH_PUBLIC_ENDPOINTS.readOpinionVector.responseKeys, ['opinions']);

  assert.equal(assertResearchPublicPayload({}, []), true);
  assert.equal(assertResearchPublicPayload(
    { participantPublicKey: 'raw-key', challenge: 'c', signature: 's' },
    RESEARCH_PUBLIC_ENDPOINTS.readOpinionVector.requestKeys
  ), true);

  for (const key of ['accountId', 'userId', 'email', 'subject', 'sessionId', 'authorization', 'jwt', 'token']) {
    assert.throws(
      () => assertResearchPublicPayload({ [key]: 'identity-link' }, [key]),
      /Identity field forbidden/
    );
  }
});

test('Research process remains structurally separate from Identity auth and main database', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'research-app.js'), 'utf8');
  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'research-server.js'), 'utf8');
  const databaseSource = fs.readFileSync(path.join(__dirname, '..', 'config', 'researchDatabase.js'), 'utf8');
  const combined = appSource + '\n' + serverSource + '\n' + databaseSource;

  assert.doesNotMatch(combined, /require\([^\n]*middleware\/auth/);
  assert.doesNotMatch(combined, /require\([^\n]*config\/(?:db|database)['"]/);
  assert.doesNotMatch(combined, /process\.env\.DATABASE_URL/);
  assert.doesNotMatch(combined, /JWT_SECRET/);
  assert.match(databaseSource, /RESEARCH_DATABASE_URL/);
});
