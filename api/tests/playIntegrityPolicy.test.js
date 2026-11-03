'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PACKAGE_NAME, isActivationAuthorized, stableJson, createRequestHash, analyzeDecodedVerdict
} = require('../services/playIntegrityPolicy');

const NOW = 1_800_000_000_000;
const ACTION = 'profile_update';
const PAYLOAD = { active: true, year: 2000, fields: ['a', 'b'] };

function decoded(overrides = {}) {
  return { tokenPayloadExternal: {
    requestDetails: {
      requestPackageName: PACKAGE_NAME,
      timestampMillis: String(NOW - 1000),
      requestHash: createRequestHash(ACTION, PAYLOAD),
      ...overrides
    },
    appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
    deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] }
  }};
}

test('activation defaults off and requires three independent gates', () => {
  assert.equal(isActivationAuthorized({}), false);
  assert.equal(isActivationAuthorized({ PLAY_INTEGRITY_ENABLED: 'true' }), false);
  assert.equal(isActivationAuthorized({
    PLAY_INTEGRITY_ENABLED: 'true', PLAY_INTEGRITY_ZERO_COST_CONFIRMED: 'true'
  }), false);
  assert.equal(isActivationAuthorized({
    PLAY_INTEGRITY_ENABLED: 'true', PLAY_INTEGRITY_ZERO_COST_CONFIRMED: 'true',
    PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER: '123456789012'
  }), true);
});

test('SHA-256 requestHash is canonical and hides plain input', () => {
  assert.equal(createRequestHash('profile_update', { b: 2, a: 1 }),
    createRequestHash('profile_update', { a: 1, b: 2 }));
  assert.equal(createRequestHash('profile_update', { a: 1 }).length, 43);
  assert.notEqual(createRequestHash('profile_update', { a: 1 }),
    createRequestHash('profile_update', { a: 2 }));
  assert.doesNotMatch(createRequestHash('profile_update', { a: 'private text' }), /private text/);
});

test('unsupported request payloads and action names fail', () => {
  assert.throws(() => stableJson({ x: undefined }), TypeError);
  assert.throws(() => createRequestHash('bad action', {}), TypeError);
});

test('valid decoded verdict is classified without user blocking', () => {
  assert.deepEqual(analyzeDecodedVerdict(decoded(), { action: ACTION, payload: PAYLOAD, now: NOW }), {
    licensingVerdict: 'NOT_AVAILABLE', enforcement: 'none',
    status: 'verified', reason: 'recognized', appRecognized: true, deviceRecognized: true
  });
});

test('missing verdict is never marked verified', () => {
  assert.deepEqual(analyzeDecodedVerdict({}, { action: ACTION, payload: PAYLOAD, now: NOW }),
    { status: 'unavailable', reason: 'no_decoded_verdict' });
});

test('package mismatch and changed payload are rejected', () => {
  assert.equal(analyzeDecodedVerdict(decoded({ requestPackageName: 'evil.app' }),
    { action: ACTION, payload: PAYLOAD, now: NOW }).reason, 'package_mismatch');
  assert.equal(analyzeDecodedVerdict(decoded(),
    { action: ACTION, payload: { active: false }, now: NOW }).reason, 'hash_mismatch');
  assert.equal(analyzeDecodedVerdict(decoded({ requestHash: 'x'.repeat(43) }),
    { action: ACTION, payload: PAYLOAD, now: NOW }).reason, 'hash_mismatch');
});

test('stale, future and malformed timestamps are rejected', () => {
  for (const timestampMillis of [String(NOW - 121_000), String(NOW + 31_000), 'invalid']) {
    assert.equal(analyzeDecodedVerdict(decoded({ timestampMillis }),
      { action: ACTION, payload: PAYLOAD, now: NOW }).reason, 'invalid_timestamp');
  }
});

test('unrecognized app or device remains untrusted', () => {
  const wrongApp = decoded();
  wrongApp.tokenPayloadExternal.appIntegrity.appRecognitionVerdict = 'UNRECOGNIZED_VERSION';
  assert.equal(analyzeDecodedVerdict(wrongApp, { action: ACTION, payload: PAYLOAD, now: NOW }).status, 'untrusted');
  const wrongDevice = decoded();
  wrongDevice.tokenPayloadExternal.deviceIntegrity.deviceRecognitionVerdict = [];
  assert.equal(analyzeDecodedVerdict(wrongDevice, { action: ACTION, payload: PAYLOAD, now: NOW }).status, 'untrusted');
});


test('licensing verdict is a signal only, with no automatic block', () => {
  const input = decoded();
  input.tokenPayloadExternal.accountDetails = { appLicensingVerdict: 'UNLICENSED' };
  const analyzed = analyzeDecodedVerdict(input, { action: ACTION, payload: PAYLOAD, now: NOW });
  assert.equal(analyzed.licensingVerdict, 'UNLICENSED');
  assert.equal(analyzed.enforcement, 'none');
  assert.equal(analyzed.status, 'verified'); // App/device signals; not legal identity or entitlement.
});

test('unexpected account details are not echoed to client classifications', () => {
  const input = decoded();
  input.tokenPayloadExternal.accountDetails = { appLicensingVerdict: 'PERSONAL_ID_123', extra: 'private' };
  const analyzed = analyzeDecodedVerdict(input, { action: ACTION, payload: PAYLOAD, now: NOW });
  assert.equal(analyzed.licensingVerdict, 'NOT_AVAILABLE');
  assert.doesNotMatch(JSON.stringify(analyzed), /PERSONAL_ID|private/);
});
