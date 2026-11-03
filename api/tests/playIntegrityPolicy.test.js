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

test('Android direct Play Integrity reserves persistent local allowance before Google SDK', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const java = fs.readFileSync(
    path.resolve(__dirname, '../../client/android/app/src/main/java/community/demos/NativePlayIntegrityPlugin.java'),
    'utf8'
  );
  const prepare = java.split('public void prepareToken(PluginCall call) {')[1]
    ?.split('public void requestToken(PluginCall call) {')[0];
  const request = java.split('public void requestToken(PluginCall call) {')[1];
  assert.ok(prepare && request, 'Manual native prepare/request methods must exist');
  assert.ok(prepare.indexOf('if (!isEnabled())') >= 0);
  assert.ok(prepare.indexOf('!reserveLocalApiAttempt("preparations")')
    > prepare.indexOf('if (!isEnabled())'));
  assert.ok(prepare.indexOf('reserveLocalApiAttempt("preparations")')
    < prepare.indexOf('IntegrityManagerFactory.createStandard(getContext())'));
  assert.ok(request.indexOf('if (!isEnabled())') >= 0);
  assert.ok(request.indexOf('!reserveLocalApiAttempt("tokenRequests")')
    > request.indexOf('if (!isEnabled())'));
  assert.ok(request.indexOf('reserveLocalApiAttempt("tokenRequests")')
    < request.indexOf('provider.request('));
  assert.match(java, /MAX_PREPARATIONS_PER_UTC_DAY = 2/);
  assert.match(java, /MAX_TOKEN_REQUESTS_PER_UTC_DAY = 2/);
});

test('Android direct Play Integrity local budgets persist without identifiers and fail on UTC rollback', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const java = fs.readFileSync(
    path.resolve(__dirname, '../../client/android/app/src/main/java/community/demos/NativePlayIntegrityPlugin.java'),
    'utf8'
  );
  const method = java.split('private synchronized boolean reserveLocalApiAttempt(String counter) {')[1]
    ?.split('private boolean isEnabled() {')[0];
  assert.ok(method, 'Native quota must serialize concurrent calls');
  assert.match(method, /getSharedPreferences\(BUDGET_PREFERENCES, Context\.MODE_PRIVATE\)/);
  assert.match(method, /nowMillis \/ 86400000L/);
  assert.match(method, /if \(storedDay > utcDay\) return false;/);
  assert.match(method, /storedDay == utcDay \? prefs\.getInt\("preparations", 0\) : 0/);
  assert.match(method, /storedDay == utcDay \? prefs\.getInt\("tokenRequests", 0\) : 0/);
  assert.match(method, /if \(used >= maxDaily\) return false;/);
  assert.ok(method.indexOf('if (storedDay > utcDay)') < method.indexOf('return prefs.edit()'),
    'Reject UTC rollback before persisting any reset');
  assert.match(method, /\.putLong\("utcDay", utcDay\)/);
  assert.match(method, /\.putInt\("preparations", preparations/);
  assert.match(method, /\.putInt\("tokenRequests", requests/);
  assert.match(method, /\.commit\(\);/);
  assert.doesNotMatch(method, /\.apply\(\)|token\.token\(|requestHash|userId|deviceId/);
  const gradle = fs.readFileSync(path.resolve(__dirname, '../../client/android/app/build.gradle'), 'utf8');
  assert.match(gradle, /buildConfigField "boolean", "PLAY_INTEGRITY_ENABLED", "false"/);
  assert.match(gradle, /buildConfigField "long", "PLAY_INTEGRITY_PROJECT_NUMBER", "0L"/);
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
