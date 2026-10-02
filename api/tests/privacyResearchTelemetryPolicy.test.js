const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FORBIDDEN_RESEARCH_LOG_KEYS,
  ALLOWED_RESEARCH_EVENT_FIELDS,
  sanitizeResearchTelemetry
} = require('../services/researchTelemetryPolicy');

test('Research telemetry allowlist excludes identity, proof material and opinions', () => {
  const forbidden = [
    'userId', 'accountId', 'email', 'authorization', 'token', 'jwt',
    'participantPublicKey', 'challenge', 'signature',
    'opinions', 'opinionVector', 'answers'
  ];
  for (const key of forbidden) {
    assert.equal(FORBIDDEN_RESEARCH_LOG_KEYS.includes(key), true);
    assert.equal(ALLOWED_RESEARCH_EVENT_FIELDS.includes(key), false);
  }
});

test('Research telemetry sanitizer drops sensitive and nested payloads', () => {
  const output = sanitizeResearchTelemetry({
    event: 'research-read',
    status: 200,
    durationBucket: 'lt-100ms',
    route: '/v1/opinion-vector/read',
    method: 'POST',
    userId: 'identity-123',
    authorization: 'Bearer secret',
    participantPublicKey: 'public-key',
    challenge: 'challenge',
    signature: 'signature',
    opinions: { q1: 'f' },
    request: { body: { opinions: { q1: 'f' } } }
  });

  assert.deepEqual(output, {
    event: 'research-read',
    status: 200,
    durationBucket: 'lt-100ms',
    route: '/v1/opinion-vector/read',
    method: 'POST'
  });
  assert.equal(JSON.stringify(output).includes('identity-123'), false);
  assert.equal(JSON.stringify(output).includes('secret'), false);
  assert.equal(JSON.stringify(output).includes('public-key'), false);
  assert.equal(JSON.stringify(output).includes('q1'), false);
});

test('Research telemetry sanitizer ignores objects even under allowed field names', () => {
  assert.deepEqual(
    sanitizeResearchTelemetry({ event: { sensitive: 'value' }, status: 204 }),
    { status: 204 }
  );
});
