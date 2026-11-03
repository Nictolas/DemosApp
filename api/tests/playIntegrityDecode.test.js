'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { decodePlayIntegrity, validToken, DECODER_URL, PLAY_INTEGRITY_SCOPE } = require('../services/playIntegrityDecode');
const { createRequestHash } = require('../services/playIntegrityPolicy');

const env = Object.freeze({
  PLAY_INTEGRITY_ENABLED: 'true',
  PLAY_INTEGRITY_ZERO_COST_CONFIRMED: 'true',
  PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER: '123456789012'
});
const token = 'a'.repeat(100);
const now = 1_800_000_000_000;
const action = 'profile_update';
const payload = { year: 2000 };
const goodResponse = {
  tokenPayloadExternal: {
    requestDetails: {
      requestPackageName: 'community.demos',
      requestHash: createRequestHash(action, payload),
      timestampMillis: String(now - 1000)
    },
    appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
    deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] }
  }
};

test('disabled path NEVER requests credentials or contacts Google', async () => {
  let touches = 0;
  const result = await decodePlayIntegrity({
    integrityToken: token,
    getAccessToken: async () => { touches++; throw Error('must not execute'); },
    fetchImpl: async () => { touches++; throw Error('must not execute'); }
  });
  assert.deepEqual(result, { status: 'disabled' });
  assert.equal(touches, 0);
});

test('malformed tokens do not trigger billing or external requests even if enabled', async () => {
  assert.equal(validToken(''), false);
  assert.equal(validToken('   '), false);
  assert.equal(validToken('a'.repeat(65537)), false);
  assert.equal(validToken(token), true);
  let touched = false;
  const result = await decodePlayIntegrity({
    integrityToken: 'bogus', env,
    getAccessToken: async () => { touched = true; return 'secret'; },
    fetchImpl: async () => { touched = true; }
  });
  assert.deepEqual(result, { status: 'unavailable', reason: 'invalid_token' });
  assert.equal(touched, false);
});

test('enabled decoder sends token only to official package-scoped Google endpoint', async () => {
  assert.match(PLAY_INTEGRITY_SCOPE, /playintegrity$/);
  assert.equal(DECODER_URL, 'https://playintegrity.googleapis.com/v1/community.demos:decodeIntegrityToken');
  const observed = {};
  const result = await decodePlayIntegrity({
    integrityToken: token, action, payload, env, now,
    getAccessToken: async () => 'fake-access-token',
    fetchImpl: async (url, options) => {
      observed.url = url;
      observed.method = options.method;
      observed.body = JSON.parse(options.body);
      observed.auth = options.headers.Authorization;
      return { ok: true, json: async () => goodResponse };
    }
  });
  assert.deepEqual(result, {
    licensingVerdict: 'NOT_AVAILABLE', enforcement: 'none',
    status: 'verified', reason: 'recognized', appRecognized: true, deviceRecognized: true
  });
  assert.equal(observed.url, DECODER_URL);
  assert.equal(observed.method, 'POST');
  assert.deepEqual(observed.body, { integrity_token: token });
  assert.equal(observed.auth, 'Bearer fake-access-token');
  assert.doesNotMatch(JSON.stringify(result), /fake-access-token|aaaaa/);
});

test('tampered decoded content fails classification', async () => {
  const result = await decodePlayIntegrity({
    integrityToken: token, action, payload: { year: 2001 }, env, now,
    getAccessToken: async () => 'fake',
    fetchImpl: async () => ({ ok: true, json: async () => goodResponse })
  });
  assert.deepEqual(result, { status: 'untrusted', reason: 'hash_mismatch' });
});

test('HTTP 429 or error produces unavailable without retry', async () => {
  let calls = 0;
  const result = await decodePlayIntegrity({
    integrityToken: token, action, payload, env,
    getAccessToken: async () => 'fake',
    fetchImpl: async () => { calls++; return { ok: false, status: 429 }; }
  });
  assert.deepEqual(result, { status: 'unavailable', reason: 'google_unavailable' });
  assert.equal(calls, 1);
});

test('network, auth and malformed response fail without leaking errors', async () => {
  const x = await decodePlayIntegrity({
    integrityToken: token, env,
    getAccessToken: async () => { throw Error('secret credential'); }
  });
  assert.deepEqual(x, { status: 'unavailable', reason: 'google_unavailable' });
  assert.doesNotMatch(JSON.stringify(x), /secret/);
  const y = await decodePlayIntegrity({
    integrityToken: token, env,
    getAccessToken: async () => 'fake',
    fetchImpl: async () => ({ ok: true, json: async () => { throw Error('secret token'); } })
  });
  assert.deepEqual(y, { status: 'unavailable', reason: 'google_unavailable' });
});
