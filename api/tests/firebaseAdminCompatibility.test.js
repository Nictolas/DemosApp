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
