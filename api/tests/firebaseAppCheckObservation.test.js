'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isObservationEnabled,
  isDiagnosticRouteEnabled,
  validTokenShape,
  createAppCheckLocalBudget,
  DEFAULT_MAX_VERIFICATIONS_PER_PROCESS_PER_DAY,
  observeAppCheckHeader,
} = require('../services/firebaseAppCheckObservation');

const validEnv = {
  FIREBASE_APP_CHECK_OBSERVE_ENABLED: 'true',
  FIREBASE_APP_CHECK_COST_GUARD_APPROVED: 'true',
  FIREBASE_PROJECT_ID: 'demos-finale',
  FIREBASE_APP_CHECK_ANDROID_APP_ID: '1:848085963511:android:abcdef012345',
};
const token = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhcHAifQ.signature123';

test('observation remains OFF unless ALL explicit gates match', async () => {
  for (const env of [
    {}, { ...validEnv, FIREBASE_APP_CHECK_OBSERVE_ENABLED: 'false' },
    { ...validEnv, FIREBASE_APP_CHECK_COST_GUARD_APPROVED: 'false' },
    { ...validEnv, FIREBASE_PROJECT_ID: 'demos-oauth-e2e' },
  ]) {
    assert.equal(isObservationEnabled(env), false);
    let calls = 0;
    const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
      env, verifyToken: async () => { calls++; throw Error('must not run'); },
    });
    assert.deepEqual(result, { status: 'disabled' });
    assert.equal(calls, 0);
  }
});

test('unconfigured Android App ID prevents any SDK verification', async () => {
  let calls = 0;
  const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
    env: { ...validEnv, FIREBASE_APP_CHECK_ANDROID_APP_ID: 'community.demos' },
    verifyToken: async () => { calls++; },
  });
  assert.deepEqual(result, { status: 'unconfigured' });
  assert.equal(calls, 0);
});

test('missing and malformed headers never hit the SDK', async () => {
  let calls = 0;
  const verifyToken = async () => { calls++; throw Error('must not run'); };
  assert.deepEqual(await observeAppCheckHeader({}, { env: validEnv, verifyToken }), { status: 'missing' });
  assert.deepEqual(await observeAppCheckHeader({ 'x-firebase-appcheck': 'not-a-jwt' }, { env: validEnv, verifyToken }), { status: 'malformed' });
  assert.deepEqual(await observeAppCheckHeader({ 'x-firebase-appcheck': 'x'.repeat(9000) }, { env: validEnv, verifyToken }), { status: 'malformed' });
  assert.equal(calls, 0);
  assert.equal(validTokenShape(token), true);
});

test('valid token for the explicitly selected app is classified, not enforced', async () => {
  let calls = 0;
  const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
    env: validEnv,
    verifyToken: async t => {
      calls++;
      assert.equal(t, token);
      return { appId: validEnv.FIREBASE_APP_CHECK_ANDROID_APP_ID };
    },
  });
  assert.deepEqual(result, { status: 'verified' });
  assert.equal(calls, 1);
});

test('token issued for another app is not trusted', async () => {
  const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
    env: validEnv, verifyToken: async () => ({ appId: '1:848085963511:web:abcdef012345' }),
  });
  assert.deepEqual(result, { status: 'different_app' });
});

test('bad signatures and verification errors expose no token or error details', async () => {
  const result = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, {
    env: validEnv, verifyToken: async () => { throw Error('sensitive-token-or-claims'); },
  });
  assert.deepEqual(result, { status: 'invalid' });
  assert.equal(JSON.stringify(result).includes('sensitive'), false);
});

test('ordinary verification is NOT replay protection', async () => {
  let calls = 0;
  const verifyToken = async () => {
    calls++;
    return { appId: validEnv.FIREBASE_APP_CHECK_ANDROID_APP_ID };
  };
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(
      await observeAppCheckHeader({ 'x-firebase-appcheck': token }, { env: validEnv, verifyToken }),
      { status: 'verified' }
    );
  }
  assert.equal(calls, 2);
});

test('the source is not mounted into routes or coupled to direct Play Integrity flags', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..', '..');
  const gradle = fs.readFileSync(path.join(root, 'client/android/app/build.gradle'), 'utf8');
  const java = fs.readFileSync(path.join(root, 'client/android/app/src/main/java/community/demos/NativeFirebaseAppCheckPlugin.java'), 'utf8');
  const ts = fs.readFileSync(path.join(root, 'client/src/lib/nativeFirebaseAppCheck.ts'), 'utf8');
  assert.match(gradle, /buildConfigField "boolean", "FIREBASE_APP_CHECK_ENABLED", "false"/);
  assert.match(java, /BuildConfig.FIREBASE_APP_CHECK_ENABLED/);
  assert.match(java, /installAppCheckProviderFactory\([\s\S]*false/);
  assert.match(java, /getAppCheckToken\(false\)/);
  assert.match(ts, /VITE_FIREBASE_APP_CHECK_ENABLED !== 'true'/);
  // Reject direct-Integrity calls in executable Java, not explanatory comments.
  const executableJava = java
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executableJava, /decodeIntegrityToken|requestHash|PLAY_INTEGRITY_PROJECT_NUMBER/);
});

test('the local App Check budget caps checks per UTC day without external calls', async () => {
  const budget = createAppCheckLocalBudget({ maxDaily: 2 });
  const t0 = Date.parse('2026-11-03T00:00:00Z');
  assert.equal(budget.remaining(t0), 2);
  assert.equal(budget.reserve(t0), true);
  assert.equal(budget.reserve(t0 + 1), true);
  assert.equal(budget.reserve(t0 + 2), false);
  assert.equal(budget.remaining(t0), 0);
  assert.equal(budget.reserve(t0 + 86400000), true);
  assert.equal(budget.remaining(t0 + 86400000), 1);
  assert.equal(DEFAULT_MAX_VERIFICATIONS_PER_PROCESS_PER_DAY, 50);
});

test('budget exhaustion skips App Check Admin verification without blocking traffic', async () => {
  const budget = createAppCheckLocalBudget({ maxDaily: 1 });
  let calls = 0;
  const opts = {
    env: validEnv,
    budget,
    verifyToken: async () => {
      calls += 1;
      return { appId: validEnv.FIREBASE_APP_CHECK_ANDROID_APP_ID };
    },
  };
  const first = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, opts);
  const second = await observeAppCheckHeader({ 'x-firebase-appcheck': token }, opts);
  assert.deepEqual(first, { status: 'verified' });
  assert.deepEqual(second, { status: 'limited' });
  assert.equal(calls, 1);
});

test('disabled and invalid requests cannot consume App Check local budget', async () => {
  const budget = createAppCheckLocalBudget({ maxDaily: 1 });
  const now = Date.now();
  for (const [headers, env] of [
    [{ 'x-firebase-appcheck': token }, { ...validEnv, FIREBASE_APP_CHECK_OBSERVE_ENABLED: 'false' }],
    [{ 'x-firebase-appcheck': 'bad' }, validEnv],
    [{}, validEnv],
  ]) {
    const outcome = await observeAppCheckHeader(headers, {
      env, budget, verifyToken: async () => { throw new Error('should not be called'); },
    });
    assert.notEqual(outcome.status, 'verified');
  }
  assert.equal(budget.remaining(now), 1);
  assert.throws(() => createAppCheckLocalBudget({ maxDaily: 1001 }), RangeError);
  assert.throws(() => createAppCheckLocalBudget({ maxDaily: -1 }), RangeError);
  assert.throws(() => createAppCheckLocalBudget({ maxDaily: 1.2 }), RangeError);
  assert.equal(createAppCheckLocalBudget({ maxDaily: 0 }).reserve(now), false);
});

test('admin diagnostic route remains absent unless every guard is approved', () => {
  assert.equal(isDiagnosticRouteEnabled({}), false);
  assert.equal(isDiagnosticRouteEnabled(validEnv), false);
  const enabled = { ...validEnv, FIREBASE_APP_CHECK_DIAGNOSTIC_ENABLED: 'true' };
  assert.equal(isDiagnosticRouteEnabled(enabled), true);
  for (const field of [
    'FIREBASE_APP_CHECK_DIAGNOSTIC_ENABLED',
    'FIREBASE_APP_CHECK_OBSERVE_ENABLED',
    'FIREBASE_APP_CHECK_COST_GUARD_APPROVED',
    'FIREBASE_PROJECT_ID',
  ]) {
    assert.equal(isDiagnosticRouteEnabled({ ...enabled, [field]: 'disabled' }), false);
  }
});

test('manual diagnostic is Admin-only, header-only, and not wired to normal flows', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..', '..');
  const app = fs.readFileSync(path.join(root, 'api/app.js'), 'utf8');
  const route = fs.readFileSync(
    path.join(root, 'api/routes/admin/firebase-app-check-diagnostic.js'), 'utf8'
  );
  const client = fs.readFileSync(
    path.join(root, 'client/src/lib/nativeFirebaseAppCheckDiagnostic.ts'), 'utf8'
  );
  assert.ok(app.includes('if (isDiagnosticRouteEnabled(process.env))'));
  assert.ok(app.includes("'/api/admin/firebase-app-check'"));
  assert.ok(app.includes("'X-Firebase-AppCheck'"));
  assert.ok(route.includes("router.post('/observe', verifyToken, requireAdmin,"));
  assert.ok(route.includes("observeAppCheckHeader(req.headers)"));
  assert.ok(!route.includes('req.query') && !route.includes('req.body'));
  assert.ok(!route.includes('console.log') && !route.includes('console.error'));
  assert.ok(client.includes("VITE_FIREBASE_APP_CHECK_DIAGNOSTIC_ENABLED !== 'true'"));
  assert.ok(client.includes("'X-Firebase-AppCheck': token"));
  assert.ok(client.includes("ALLOWED_API_HOSTS.has(base.hostname)"));
  assert.ok(!client.includes('setInterval') && !client.includes('setTimeout'));
});
