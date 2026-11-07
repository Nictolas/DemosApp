const test = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('../services/firebaseAdmin');

function freshService() {
  delete require.cache[servicePath];
  return require(servicePath);
}

async function withFirebaseEnvCleared(fn) {
  const keys = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  try {
    return await fn();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('Firebase Admin 14 modular entry points required by DEMOS are available', () => {
  const app = require('firebase-admin/app');
  const messaging = require('firebase-admin/messaging');

  assert.equal(typeof app.getApps, 'function');
  assert.equal(typeof app.initializeApp, 'function');
  assert.equal(typeof app.cert, 'function');
  assert.equal(typeof messaging.getMessaging, 'function');
});

test('Firebase Admin service fails closed when credentials are absent', async () => {
  await withFirebaseEnvCleared(async () => {
    const { getApps, deleteApp } = require('firebase-admin/app');
    for (const app of getApps()) await deleteApp(app);

    const service = freshService();
    assert.equal(service.initializeFirebaseAdmin(), null);
    assert.equal(service.isInitialized(), false);
  });
});

test('Firebase Admin service preserves admin.messaging() compatibility on v14', async () => {
  const { initializeApp, deleteApp, getApps } = require('firebase-admin/app');

  for (const app of getApps()) await deleteApp(app);
  const app = initializeApp({}, 'cp049-compat-test');

  try {
    const service = freshService();
    const admin = service.initializeFirebaseAdmin();

    assert.ok(admin);
    assert.equal(service.isInitialized(), true);
    assert.equal(typeof admin.messaging, 'function');
    const messaging = admin.messaging();
    assert.equal(typeof messaging.send, 'function');
  } finally {
    await deleteApp(app);
  }
});

test('real Firebase Admin 14 cert() project identity without network', async () => {
  // Ephemeral, fictitious local key: never sent to Google, persisted, logged
  // or used to request Firebase access tokens. This tests SDK behavior, not
  // Google Play attestation or any real DEMOS credential.
  const { generateKeyPairSync } = require('node:crypto');
  const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
  const { isApprovedFirebaseAdminApp } = require('../services/firebaseAppCheckObservation');
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  });

  const apps = [];
  const makeApp = (credentialProject, explicitProject) => {
    const credential = cert({
      projectId: credentialProject,
      clientEmail: `offline-fixture@${credentialProject}.iam.gserviceaccount.com`,
      privateKey,
    });
    const options = { credential };
    if (explicitProject) options.projectId = explicitProject;
    const app = initializeApp(options, `app-check-project-contract-${apps.length}`);
    apps.push(app);
    return app;
  };

  try {
    const allowed = makeApp('demos-finale');
    assert.equal(allowed.options.projectId, undefined);
    assert.equal(allowed.options.credential.projectId, 'demos-finale');
    assert.equal(isApprovedFirebaseAdminApp(allowed), true);

    const denied = makeApp('other-firebase-project');
    assert.equal(isApprovedFirebaseAdminApp(denied), false);

    const conflicting = makeApp('other-firebase-project', 'demos-finale');
    assert.equal(isApprovedFirebaseAdminApp(conflicting), false);

    const explicit = makeApp('demos-finale', 'demos-finale');
    assert.equal(isApprovedFirebaseAdminApp(explicit), true);
  } finally {
    for (const app of apps) await deleteApp(app);
  }
});
