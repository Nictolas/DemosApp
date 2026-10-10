'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../services/accessRevocationService');

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value == null) delete process.env[key]; else process.env[key] = value;
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key]; else process.env[key] = value;
    }
  });
}

test('staging can explicitly use the in-memory revocation store for isolated E2E', async () => {
  await withEnv({ NODE_ENV: 'staging', DEMOS_STAGING_IN_MEMORY_REVOCATION: 'true' }, async () => {
    const sessionId = 'staging-e2e-revocation-test';
    assert.equal(service.stagingMemoryFallbackEnabled(), true);
    assert.equal(await service.isAccessSessionRevoked({ jti: sessionId }), false);
    await service.revokeAccessSession(sessionId, 60);
    assert.equal(await service.isAccessSessionRevoked({ jti: sessionId }), true);
  });
});

test('production remains fail-closed even if the staging flag is accidentally present', async () => {
  await withEnv({ NODE_ENV: 'production', DEMOS_STAGING_IN_MEMORY_REVOCATION: 'true' }, async () => {
    assert.equal(service.stagingMemoryFallbackEnabled(), false);
    await assert.rejects(
      () => service.isAccessSessionRevoked({ jti: 'production-must-not-fallback' }),
      (error) => error && error.code === 'ACCESS_REVOCATION_STORE_UNAVAILABLE',
    );
  });
});
