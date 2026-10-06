const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  RESEARCH_PUBLIC_ENDPOINTS,
  assertResearchPublicPayload
} = require('../services/researchPublicApiContract');

test('Research public API contract exposes only pseudonymous proof material and minimized reads', () => {
  assert.deepEqual(RESEARCH_PUBLIC_ENDPOINTS.issueChallenge.requestKeys, []);
  assert.deepEqual(RESEARCH_PUBLIC_ENDPOINTS.issueChallenge.responseKeys, ['challenge', 'purpose']);
  assert.deepEqual(
    RESEARCH_PUBLIC_ENDPOINTS.readOpinionVector.requestKeys,
    ['participantPublicKey', 'challenge', 'signature']
  );
  assert.deepEqual(RESEARCH_PUBLIC_ENDPOINTS.readOpinionVector.responseKeys, ['opinions']);
  assert.deepEqual(RESEARCH_PUBLIC_ENDPOINTS.readAnswerAggregates.requestKeys, ['questionId']);
  assert.deepEqual(RESEARCH_PUBLIC_ENDPOINTS.readAnswerAggregates.responseKeys, ['methodology', 'rows']);

  assert.equal(assertResearchPublicPayload({}, []), true);
  assert.equal(assertResearchPublicPayload(
    { participantPublicKey: 'raw-key', challenge: 'c', signature: 's' },
    RESEARCH_PUBLIC_ENDPOINTS.readOpinionVector.requestKeys
  ), true);
  assert.equal(assertResearchPublicPayload(
    { questionId: 'energia_nucleare' },
    RESEARCH_PUBLIC_ENDPOINTS.readAnswerAggregates.requestKeys
  ), true);

  for (const key of ['accountId', 'userId', 'email', 'subject', 'sessionId', 'authorization', 'jwt', 'token']) {
    assert.throws(
      () => assertResearchPublicPayload({ [key]: 'identity-link' }, [key]),
      /Identity field forbidden/
    );
  }
});

test('aggregate public request cannot choose privacy threshold or freshness metadata', () => {
  for (const key of ['minimumCellSize', 'generatedAt', 'publicationMode', 'materialization', 'cacheTtlSeconds']) {
    assert.throws(
      () => assertResearchPublicPayload(
        { questionId: 'energia_nucleare', [key]: 'caller-controlled' },
        RESEARCH_PUBLIC_ENDPOINTS.readAnswerAggregates.requestKeys
      ),
      /Unexpected Research public boundary field/
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
