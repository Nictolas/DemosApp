'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer, assertDeploymentOnlyEnvironment } =
  require('../staging/civic_render_boot_probe');

const safe = Object.freeze({ CIVIC_STAGING_PROBE_ONLY: 'true' });

test('deployment-only staging probe requires explicit opt-in', () => {
  assert.throws(() => assertDeploymentOnlyEnvironment({}),
    /CIVIC_STAGING_PROBE_NOT_AUTHORIZED/);
  assert.equal(assertDeploymentOnlyEnvironment(safe), true);
});

test('staging deployment probe refuses all direct database and provider credentials', () => {
  for (const key of ['DATABASE_URL','PGHOST','PGUSER','SUPABASE_SERVICE_ROLE_KEY',
                     'GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_SERVICE_ACCOUNT',
                     'FIREBASE_SERVICE_ACCOUNT_JSON']) {
    assert.throws(() => assertDeploymentOnlyEnvironment({...safe, [key]: 'sensitive'}),
      /CIVIC_STAGING_PROBE_CREDENTIALS_NOT_PERMITTED/);
  }
});

test('staging deployment probe refuses feature activation or affinity approval flags', () => {
  for (const key of ['CIVIC_PUSH_ENABLED','CIVIC_NEW_INITIATIVE_EVENTS_ENABLED',
                     'CIVIC_SESSION_LOCK_CONNECTION_VERIFIED',
                     'CIVIC_SESSION_AFFINITY_PROBE_APPLY',
                     'CIVIC_TOPIC_RECONCILE_APPLY','CIVIC_ROLLBACK_APPLY']) {
    assert.throws(() => assertDeploymentOnlyEnvironment({...safe, [key]:'true'}),
      /CIVIC_STAGING_PROBE_ACTIVE_FLAGS_REFUSED/);
  }
});

test('HTTP endpoint reports only a non-GO, no-database no-Firebase status', async () => {
  const server = createServer(safe);
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const {port} = server.address();
    const status = await fetch('http://127.0.0.1:' + port + '/health');
    assert.equal(status.status, 200);
    assert.equal(status.headers.get('cache-control'), 'no-store');
    const result = await status.json();
    assert.deepEqual(result, {
      service: 'demos-civic-staging-deploy-probe',
      deployment: 'RUNNING',
      database: 'NOT_TESTED',
      backend: 'NOT_STARTED',
      sessionAffinity: 'NOT_TESTED',
      directDns: 'NOT_TESTED',
      firebase: 'DISABLED',
      civicPush: 'DISABLED',
      releaseGate: 'NO_GO',
    });
    const notFound = await fetch('http://127.0.0.1:' + port + '/anything');
    assert.equal(notFound.status, 404);
    const disallowedMethod = await fetch('http://127.0.0.1:' + port + '/health',
      {method: 'POST'});
    assert.equal(disallowedMethod.status, 404);
    assert.equal(require.cache[require.resolve('../config/database')], undefined);
    assert.equal(require.cache[require.resolve('../services/firebaseAdmin')], undefined);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
