'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXPECTED_FIREBASE_PROJECT_NUMBER,
  EXPECTED_FIREBASE_ANDROID_APP_ID,
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
  FIREBASE_APP_CHECK_ANDROID_APP_ID: '1:848085963511:android:8f8047e4c6a38b11d0b9f2',
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

test('the exact DEMOS Firebase app ID is required, including the app suffix', async () => {
  assert.equal(EXPECTED_FIREBASE_ANDROID_APP_ID, validEnv.FIREBASE_APP_CHECK_ANDROID_APP_ID);
  const budget = createAppCheckLocalBudget({ maxDaily: 1 });
  let calls = 0;
  const bad = [
    '1:848085963511:android:abcdef012345',
    '1:848085963511:android:8f8047e4c6a38b11d0b9f3',
    '1:848085963511:android:8f8047e4c6a38b11d0b9f2 ',
  ];
  for (const value of bad) {
    const result = await observeAppCheckHeader(
      { 'x-firebase-appcheck': token },
      {
        env: { ...validEnv, FIREBASE_APP_CHECK_ANDROID_APP_ID: value },
        budget,
        verifyToken: async () => { calls++; },
      }
    );
    assert.deepEqual(result, { status: 'unconfigured' });
  }
  assert.equal(calls, 0);
  assert.equal(budget.remaining(), 1);
});

test('a Firebase Android App ID from another numeric project cannot reach the SDK', async () => {
  assert.equal(EXPECTED_FIREBASE_PROJECT_NUMBER, '848085963511');
  const budget = createAppCheckLocalBudget({ maxDaily: 1 });
  let calls = 0;
  const badIds = [
    '1:32555940559:android:abcdef012345',
    '1:848085963512:android:abcdef012345',
    '1:848085963511:web:abcdef012345',
    '1:848085963511:android:abcdef012345-unsafe',
  ];
  for (const appId of badIds) {
    const response = await observeAppCheckHeader(
      { 'x-firebase-appcheck': token },
      {
        env: { ...validEnv, FIREBASE_APP_CHECK_ANDROID_APP_ID: appId },
        budget,
        verifyToken: async () => {
          calls++;
          throw Error('wrong project must not be queried');
        },
      },
    );
    assert.deepEqual(response, { status: 'unconfigured' });
  }
  assert.equal(calls, 0);
  assert.equal(budget.remaining(), 1);
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

test('expired and wrong-project tokens remain untrusted without leaking claims', async () => {
  for (const errorCode of ['app-check-token-expired', 'app-check-project-mismatch']) {
    const result = await observeAppCheckHeader(
      { 'x-firebase-appcheck': token },
      {
        env: validEnv,
        budget: createAppCheckLocalBudget({ maxDaily: 2 }),
        verifyToken: async () => {
          const err = new Error('private-claims-and-token');
          err.code = errorCode;
          throw err;
        },
      }
    );
    assert.deepEqual(result, { status: 'invalid' });
    assert.equal(JSON.stringify(result).includes('private'), false);
  }
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

test('admin diagnostic route enforces auth and role at runtime without Google calls', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../routes/admin/firebase-app-check-diagnostic.js'),
    'utf8'
  );
  let registered = null;
  let verificationCalls = 0;
  let middlewareCalls = 0;
  let enabled = true;
  const router = {
    post(pathName, ...handlers) {
      registered = { pathName, handlers };
    },
  };
  const verifyToken = (req, res, next) => {
    middlewareCalls++;
    if (req.headers.authorization !== 'Bearer mock-admin-session') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  const requireAdmin = (req, res, next) => {
    middlewareCalls++;
    if (req.admin !== true) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
  const sandbox = {
    module: { exports: {} },
    require(specifier) {
      if (specifier === 'express') return { Router: () => router };
      if (specifier === '../../middleware/auth') return { verifyToken, requireAdmin };
      if (specifier === '../../services/firebaseAppCheckObservation') {
        return {
          isDiagnosticRouteEnabled: () => enabled,
          observeAppCheckHeader: async headers => {
            verificationCalls++;
            assert.equal(headers['x-firebase-appcheck'], token);
            return { status: 'verified' };
          },
        };
      }
      throw new Error('Unexpected dependency: ' + specifier);
    },
  };
  vm.runInNewContext(source, sandbox, { filename: 'firebase-app-check-diagnostic.js' });
  assert.equal(registered.pathName, '/observe');
  assert.equal(registered.handlers.length, 3);

  async function simulate({ authorization, admin = false }) {
    const req = { admin, headers: {
      authorization,
      'x-firebase-appcheck': token,
    } };
    const res = {
      statusCode: 200,
      headers: {},
      body: undefined,
      status(n) { this.statusCode = n; return this; },
      set(k, v) { this.headers[k] = v; return this; },
      json(value) { this.body = value; return this; },
      end() { return this; },
    };
    // Run the actual registered router handler chain in order, without HTTP,
    // Firebase SDK initialization, network requests or real account tokens.
    let handlerIndex = 0;
    async function advance() {
      if (handlerIndex >= registered.handlers.length) return;
      const handler = registered.handlers[handlerIndex++];
      let nextCalled = false;
      const result = handler(req, res, () => { nextCalled = true; });
      await result;
      if (nextCalled) await advance();
    }
    await advance();
    return res;
  }

  const anonymous = await simulate({ authorization: undefined });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(verificationCalls, 0);

  const nonAdmin = await simulate({ authorization: 'Bearer mock-admin-session' });
  assert.equal(nonAdmin.statusCode, 403);
  assert.equal(verificationCalls, 0);

  enabled = false;
  const disabled = await simulate({ authorization: 'Bearer mock-admin-session', admin: true });
  assert.equal(disabled.statusCode, 404);
  assert.equal(verificationCalls, 0);

  enabled = true;
  const allowed = await simulate({ authorization: 'Bearer mock-admin-session', admin: true });
  assert.equal(allowed.statusCode, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(allowed.body)), { status: 'verified' });
  assert.equal(allowed.headers['Cache-Control'], 'no-store');
  assert.equal(verificationCalls, 1);
  assert.equal(middlewareCalls, 7);
});

test('manual Android App Check requests persist a small per-installation UTC budget', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const java = fs.readFileSync(
    path.resolve(__dirname, '../../client/android/app/src/main/java/community/demos/NativeFirebaseAppCheckPlugin.java'),
    'utf8'
  );
  const gradle = fs.readFileSync(
    path.resolve(__dirname, '../../client/android/app/build.gradle'),
    'utf8'
  );
  assert.match(gradle, /buildConfigField "boolean", "FIREBASE_APP_CHECK_ENABLED", "false"/);
  assert.match(java, /private static final int MAX_MANUAL_ATTEMPTS_PER_UTC_DAY = 2;/);
  assert.match(java, /private static final long MILLIS_PER_UTC_DAY = 86_400_000L;/);
  assert.match(java, /SharedPreferences prefs = getContext\(\)\.getSharedPreferences/);
  assert.match(java, /prefs\.edit\(\)[\s\S]*\.commit\(\)/);
  assert.match(java, /attempts >= MAX_MANUAL_ATTEMPTS_PER_UTC_DAY/);
  const requestMethod = java.split('public void requestToken(PluginCall call) {')[1]
    ?.split('private FirebaseAppCheck getAppCheckIfConfigured()')[0];
  assert.ok(requestMethod);
  const gateAt = requestMethod.indexOf('if (!isEnabled())');
  const quotaAt = requestMethod.indexOf('if (!reserveManualAttestationAttempt())');
  const initAt = requestMethod.indexOf('getAppCheckIfConfigured()');
  const sdkAt = requestMethod.indexOf('getAppCheckToken(false)');
  assert.ok(gateAt !== -1 && quotaAt > gateAt && initAt > quotaAt && sdkAt > initAt,
    'Disabled gate and durable quota must execute before Firebase provider initialization and token SDK request');
  assert.doesNotMatch(java, /getAppCheckToken\(true\)/);
});

test('manual Android quota rejects backward UTC day and persists before touching SDK', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const java = fs.readFileSync(
    path.resolve(__dirname, '../../client/android/app/src/main/java/community/demos/NativeFirebaseAppCheckPlugin.java'),
    'utf8'
  );
  const budget = java.split('private boolean reserveManualAttestationAttempt() {')[1]
    ?.split('private boolean isEnabled()')[0];
  assert.ok(budget, 'Manual limit function must remain present');
  assert.match(budget, /if \(storedDay > day\) return false;/);
  const clockRollbackAt = budget.indexOf('if (storedDay > day) return false;');
  const dayResetAt = budget.indexOf('storedDay == day ?');
  const persistAt = budget.lastIndexOf('.commit();'); // Ignore comment mentioning commit().
  assert.ok(clockRollbackAt !== -1 && clockRollbackAt < dayResetAt && persistAt > dayResetAt,
    'Rollback rejection must precede daily reset and persistent reservation');
  assert.ok(!budget.includes('apply()'), 'Reservation must be persisted synchronously');
});

test('native App Check identity guard matches approved backend Firebase app and project', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const java = fs.readFileSync(
    path.resolve(__dirname, '../../client/android/app/src/main/java/community/demos/NativeFirebaseAppCheckPlugin.java'), 'utf8'
  );
  const backend = fs.readFileSync(
    path.resolve(__dirname, '../services/firebaseAppCheckObservation.js'), 'utf8'
  );
  const clientAppId = java.match(/EXPECTED_FIREBASE_APP_ID\s*=\s*"([^"]+)"/)?.[1];
  const serverAppId = backend.match(/EXPECTED_FIREBASE_ANDROID_APP_ID\s*=\s*'([^']+)'/)?.[1];
  const clientProject = java.match(/EXPECTED_FIREBASE_PROJECT\s*=\s*"([^"]+)"/)?.[1];
  const serverProject = backend.match(/EXPECTED_FIREBASE_PROJECT\s*=\s*'([^']+)'/)?.[1];
  assert.equal(clientAppId, EXPECTED_FIREBASE_ANDROID_APP_ID);
  assert.equal(clientAppId, serverAppId);
  assert.equal(clientProject, serverProject);
  assert.match(java, /EXPECTED_PACKAGE = "community\.demos"/);
  assert.match(java, /EXPECTED_FIREBASE_SENDER = "848085963511"/);
  assert.match(java, /isApprovedFirebaseOptions\(FirebaseOptions\.fromResource\(getContext\(\)\)\)/);
  assert.match(java, /EXPECTED_FIREBASE_APP_ID\.equals\(options\.getApplicationId\(\)\)/);
  assert.match(java, /EXPECTED_FIREBASE_PROJECT\.equals\(options\.getProjectId\(\)\)/);
  assert.match(java, /EXPECTED_FIREBASE_SENDER\.equals\(options\.getGcmSenderId\(\)\)/);
});

test('missing or wrong Firebase resources are rejected before quota and provider initialization', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const java = fs.readFileSync(
    path.resolve(__dirname, '../../client/android/app/src/main/java/community/demos/NativeFirebaseAppCheckPlugin.java'), 'utf8'
  );
  const request = java.split('public void requestToken(PluginCall call) {')[1]
    ?.split('private FirebaseAppCheck getAppCheckIfConfigured()')[0];
  const provider = java.split('private FirebaseAppCheck getAppCheckIfConfigured() {')[1];
  assert.ok(request && provider);
  const configAt = request.indexOf('if (!hasApprovedFirebaseConfiguration())');
  const quotaAt = request.indexOf('if (!reserveManualAttestationAttempt())');
  const initAt = request.indexOf('getAppCheckIfConfigured()');
  const sdkAt = request.indexOf('getAppCheckToken(false)');
  assert.ok(configAt >= 0 && quotaAt > configAt && initAt > quotaAt && sdkAt > initAt,
    'Firebase resource validation must precede budget reservation and SDK calls');
  assert.ok(provider.indexOf('if (!hasApprovedFirebaseConfiguration()) return null;')
    < provider.indexOf('FirebaseApp.initializeApp(getContext())'));
  assert.ok(provider.indexOf('!isApprovedFirebaseOptions(app.getOptions())')
    < provider.indexOf('FirebaseAppCheck.getInstance(app)'));
  assert.match(request, /Configurazione Firebase DEMOS non valida/);
  // No live Google calls, no permission escalation, and Android build gate stays OFF.
  const gradle = fs.readFileSync(path.resolve(__dirname, '../../client/android/app/build.gradle'), 'utf8');
  assert.match(gradle, /buildConfigField "boolean", "FIREBASE_APP_CHECK_ENABLED", "false"/);
});

test('signed Android release fails closed on missing or wrong Firebase config', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const gradle = fs.readFileSync(
    path.resolve(__dirname, '../../client/android/app/build.gradle'), 'utf8'
  );
  const verifyStart = gradle.indexOf('def verifyDemosSignedReleaseFirebaseConfig = {');
  const attachStart = gradle.indexOf("tasks.matching { it.name == 'preReleaseBuild' }");
  assert.ok(verifyStart !== -1 && attachStart > verifyStart,
    'Release Firebase guard must exist and attach to preReleaseBuild');
  const verifySource = gradle.slice(verifyStart, attachStart);
  assert.match(verifySource, /file\('google-services\.json'\)/);
  assert.match(verifySource, /if \(!firebaseFile\.isFile\(\)\)/);
  assert.match(verifySource, /new groovy\.json\.JsonSlurper\(\)\.parse\(firebaseFile\)/);
  assert.match(verifySource, /project_info\?\.project_id != 'demos-finale'/);
  assert.match(verifySource, /project_info\?\.project_number\?\.toString\(\) != '848085963511'/);
  assert.match(verifySource, /android_client_info\?\.package_name == 'community\.demos'/);
  assert.match(verifySource, /mobilesdk_app_id\s*== '1:848085963511:android:8f8047e4c6a38b11d0b9f2'/);
  assert.match(verifySource, /throw new GradleException\('DEMOS signed release:/);
  assert.match(gradle.slice(attachStart), /if \(keystorePropertiesFile\.exists\(\)\)\s*\{\s*verifyDemosSignedReleaseFirebaseConfig\(\)/);
  assert.doesNotMatch(verifySource, /logger\.|println\(|storePassword|keyPassword/);
});

test('Android local CI remains unsigned and never needs to upload Firebase or signing secrets', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../..');
  const gradle = fs.readFileSync(path.join(root, 'client/android/app/build.gradle'), 'utf8');
  const workflow = fs.readFileSync(
    path.join(root, '.github/workflows/android-alpha-validation.yml'), 'utf8'
  );
  const ignore = fs.readFileSync(path.join(root, 'client/android/.gitignore'), 'utf8');
  assert.match(gradle, /if \(keystorePropertiesFile\.exists\(\)\)\s*\{\s*verifyDemosSignedReleaseFirebaseConfig\(\)/);
  assert.match(workflow, /Build Android debug APK and release AAB \(unsigned in CI\)/);
  assert.match(workflow, /Archive UNSIGNED release candidate for authorized signing/);
  assert.match(ignore, /^google-services\.json$/m);
  assert.match(ignore, /^keystore\.properties$/m);
  assert.match(ignore, /^\*\.jks$/m);
});
