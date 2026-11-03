'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PACKAGE_NAME, EXPECTED_CLOUD_PROJECT_NUMBER, isActivationAuthorized, stableJson, createRequestHash, analyzeDecodedVerdict
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
    PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER: EXPECTED_CLOUD_PROJECT_NUMBER
  }), true);
});

test('only the pre-existing DEMOS Cloud project can unlock direct Play Integrity', () => {
  assert.equal(EXPECTED_CLOUD_PROJECT_NUMBER, '848085963511');
  for (const projectNumber of ['', '123456789012', '0848085963511', '848085963512', '848085963511 ', 'demos-finale']) {
    assert.equal(isActivationAuthorized({
      PLAY_INTEGRITY_ENABLED: 'true',
      PLAY_INTEGRITY_ZERO_COST_CONFIRMED: 'true',
      PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER: projectNumber
    }), false, 'Wrong Cloud project must be disabled: ' + projectNumber);
  }
  assert.equal(isActivationAuthorized({
    PLAY_INTEGRITY_ENABLED: 'true',
    PLAY_INTEGRITY_ZERO_COST_CONFIRMED: 'true',
    PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER: EXPECTED_CLOUD_PROJECT_NUMBER
  }), true);
});

test('Android native Play Integrity gate pins exactly the same Cloud project as backend', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const java = fs.readFileSync(
    path.resolve(__dirname, '../../client/android/app/src/main/java/community/demos/NativePlayIntegrityPlugin.java'),
    'utf8'
  );
  const match = java.match(/EXPECTED_CLOUD_PROJECT_NUMBER\s*=\s*(\d+)L;/);
  assert.ok(match, 'Android must pin approved Cloud project');
  assert.equal(match[1], EXPECTED_CLOUD_PROJECT_NUMBER);
  assert.match(java, /BuildConfig\.PLAY_INTEGRITY_PROJECT_NUMBER == EXPECTED_CLOUD_PROJECT_NUMBER/);
  assert.match(java, /BuildConfig\.PLAY_INTEGRITY_ENABLED/);
  assert.doesNotMatch(java, /PLAY_INTEGRITY_PROJECT_NUMBER > 0L/);
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


test('app binary package must not contradict the package in requestDetails', () => {
  const input = decoded();
  input.tokenPayloadExternal.appIntegrity.packageName = 'forged.demo';
  const verdict = analyzeDecodedVerdict(input, { action: ACTION, payload: PAYLOAD, now: NOW });
  assert.deepEqual(verdict, { status: 'untrusted', reason: 'app_binary_package_mismatch' });
});

test('Google-cleared replay verdict is not classified as verified', () => {
  const input = decoded();
  input.tokenPayloadExternal.appIntegrity.appRecognitionVerdict = 'UNEVALUATED';
  input.tokenPayloadExternal.accountDetails = { appLicensingVerdict: 'UNEVALUATED' };
  input.tokenPayloadExternal.deviceIntegrity.deviceRecognitionVerdict = [];
  const verdict = analyzeDecodedVerdict(input, { action: ACTION, payload: PAYLOAD, now: NOW });
  assert.equal(verdict.status, 'untrusted');
  assert.equal(verdict.enforcement, 'none'); // No denial of DEMOS access.
  assert.equal(verdict.licensingVerdict, 'UNEVALUATED');
});
