'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertCivicStagingSessionEndpoint } =
  require('../services/civicStagingSessionEndpointSafety');
const { runCivicStagingSessionCheck } =
  require('../scripts/checkCivicStagingSessionOnRender');

const PROJECT = 'fkeayjzvtuvzesljhjbc';
const HOST = 'aws-7-eu-central-1.pooler.supabase.com'; // Fake CI example, never connect.
const URL = `postgresql://demos_staging_runtime.${PROJECT}:ci-FakePass@ `;
const CONNECTION = `postgresql://demos_staging_runtime.${PROJECT}:ci-FakePass@${HOST}:5432/postgres`;
const options = {
  connectionString: CONNECTION,
  projectRef: PROJECT,
  expectedPoolerHost: HOST,
};

const approved = Object.freeze({
  CIVIC_STAGING_SESSION_CHECK_APPLY: 'true',
  CIVIC_UNIFIED_STAGING_READY: 'true',
  CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED: 'true',
  CIVIC_STAGING_SESSION_CHECK_CONFIRM:
    'I_APPROVE_READONLY_CIVIC_STAGING_SESSION_CHECK',
  CIVIC_STAGING_SESSION_CHECK_ENV: 'staging',
  CIVIC_STAGING_SESSION_DATABASE_URL: CONNECTION,
  CIVIC_STAGING_PROJECT_REF: PROJECT,
  CIVIC_STAGING_EXPECTED_POOLER_HOST: HOST,
});

test('accepts only the exact stage pooler session endpoint (syntax check, not login)', () => {
  assert.equal(assertCivicStagingSessionEndpoint(options), true);
  for (const bad of [
    {connectionString: CONNECTION.replace(':5432/', ':6543/')},
    {connectionString: CONNECTION.replace(HOST, `db.${PROJECT}.supabase.co`)},
    {connectionString: CONNECTION.replace(HOST, 'aws-3-us-east-1.pooler.supabase.com')},
    {connectionString: CONNECTION.replace('demos_staging_runtime.', 'postgres.')},
    {connectionString: CONNECTION.replace('ci-FakePass', '[YOUR-PASSWORD]')},
    {connectionString: CONNECTION.replace('/postgres', '/template1')},
    {connectionString: CONNECTION + '?sslmode=disable'},
    {connectionString: CONNECTION + '?host=other.example.org'},
    {expectedPoolerHost: 'aws-0-eu-central-1.pooler.supabase.com'},
    {projectRef: 'aaaaaaaaaaaaaaaaaaaa'},
  ]) {
    assert.throws(
      () => assertCivicStagingSessionEndpoint({...options, ...bad}),
      err => err.message.startsWith('CIVIC_STAGING_SESSION_') &&
        !err.message.includes('ci-FakePass')
    );
  }
});

test('cannot redirect a staging-only diagnostic to the production project', async () => {
  const productionRef = 'wxnblcqoyjqxktwkcqok';
  const alternativeRef = 'aaaaaaaaaaaaaaaaaaaa';
  for (const otherRef of [productionRef, alternativeRef]) {
    const alteredConnection = CONNECTION.replace(PROJECT, otherRef);
    assert.throws(
      () => assertCivicStagingSessionEndpoint({
        connectionString: alteredConnection, projectRef: otherRef,
        expectedPoolerHost: HOST,
      }),
      error => error.message === 'CIVIC_STAGING_SESSION_WRONG_PROJECT' &&
        !error.message.includes(otherRef)
    );
    let poolsCreated = 0;
    await assert.rejects(runCivicStagingSessionCheck({
      ...approved,
      CIVIC_STAGING_PROJECT_REF: otherRef,
      CIVIC_STAGING_SESSION_DATABASE_URL: alteredConnection,
    }, {
      createPool: () => { poolsCreated++; throw new Error('unexpected database access'); },
    }), /CIVIC_STAGING_SESSION_WRONG_PROJECT/);
    assert.equal(poolsCreated, 0, 'Invalid project must be rejected before DB connection');
  }
});

test('refuses production DB variables, push flags and malformed staging metadata', () => {
  const badEnv = [
    {DATABASE_URL: 'postgresql://actual-prod-secret'},
    {PGHOST: 'db.production.internal'},
    {PGUSER: 'postgres'},
    {SUPABASE_SERVICE_ROLE_KEY: 'unsafe'},
    {CIVIC_PUSH_ENABLED: 'true'},
    {CIVIC_NEW_INITIATIVE_EVENTS_ENABLED: 'true'},
    {CIVIC_SESSION_LOCK_CONNECTION_VERIFIED: 'true'},
  ];
  for (const env of badEnv) {
    assert.throws(
      () => assertCivicStagingSessionEndpoint({...options, env}),
      /CIVIC_STAGING_SESSION_UNSAFE_ENVIRONMENT/
    );
  }
  assert.throws(
    () => assertCivicStagingSessionEndpoint({...options, expectedPoolerHost: ''}),
    /CIVIC_STAGING_SESSION_EXACT_ENDPOINT_REQUIRED/
  );
  assert.throws(
    () => assertCivicStagingSessionEndpoint({...options, projectRef: undefined}),
    /CIVIC_STAGING_SESSION_EXACT_ENDPOINT_REQUIRED/
  );
});

test('default preview never imports a PostgreSQL client or contacts a database', async () => {
  let calls = 0;
  const result = await runCivicStagingSessionCheck({}, {
    createPool: () => { calls++; throw new Error('must not connect'); },
  });
  assert.equal(result.result, 'NOT_TESTED');
  assert.equal(result.compatible, false);
  assert.equal(calls, 0);
});

test('unified staging bootstrap always refuses live connections before pool creation', async () => {
  let opened = 0;
  for (const env of [
    {...approved, CIVIC_UNIFIED_STAGING_READY: ''},
    {...approved, CIVIC_UNIFIED_STAGING_READY: 'false'},
    {...approved, CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED: undefined},
    {...approved, CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED: 'false'},
  ]) {
    await assert.rejects(runCivicStagingSessionCheck(env, {
      createPool: () => { opened++; throw new Error('forbidden database socket'); },
    }), /CIVIC_UNIFIED_STAGING_BOOTSTRAP_NOT_READY/);
  }
  assert.equal(opened, 0);
});

test('required stage-only confirmation prevents any network access', async () => {
  let calls = 0;
  for (const env of [
    {...approved, CIVIC_STAGING_SESSION_CHECK_CONFIRM: ''},
    {...approved, CIVIC_STAGING_SESSION_CHECK_ENV: 'production'},
    {...approved, CIVIC_STAGING_EXPECTED_POOLER_HOST: ''},
    {...approved, DATABASE_URL: 'unsafe-prod'},
  ]) {
    await assert.rejects(runCivicStagingSessionCheck(env, {
      createPool: () => { calls++; throw new Error('must not connect'); },
    }), /CIVIC_STAGING_SESSION_/);
  }
  assert.equal(calls, 0);
});

function syntheticPool({pids = [['101'], ['202']], throwError = false} = {}) {
  let created = 0;
  const queries = [];
  let ended = 0;
  const pool = {
    options: {max: 2},
    async connect() {
      const index = created++;
      let n = 0;
      return {
        async query(sql) {
          queries.push(sql);
          if (throwError) throw new Error('provider RAW PASSWORD ci-FakePass');
          const source = pids[index];
          return {rows: [{pid: source[Math.min(n++, source.length - 1)]}]};
        },
        release() {},
      };
    },
    async end() { ended++; },
  };
  return {pool, queries, get created() {return created;}, get ended() {return ended;}};
}

test('two staging-only clients observe backend PIDs but never approve delivery', async () => {
  const stub = syntheticPool();
  let captured;
  const result = await runCivicStagingSessionCheck(approved, {
    createPool: opts => {captured = opts; return stub.pool;},
  });
  assert.equal(result.result, 'INCONCLUSIVE');
  assert.equal(result.compatible, false);
  assert.equal(result.operatorReviewRequired, true);
  assert.equal(stub.created, 2);
  assert.equal(stub.queries.length, 12);
  assert.ok(stub.queries.every(sql => sql === 'SELECT pg_backend_pid()::text AS pid'));
  assert.equal(stub.ended, 1);
  assert.equal(captured.max, 2);
  assert.equal(captured.ssl.rejectUnauthorized, true);
  assert.equal(captured.connectionTimeoutMillis, 5000);
  assert.equal(captured.query_timeout, 5000);
});

test('unsafe affinity or driver error cannot become a GO and always closes pool', async () => {
  const mismatch = syntheticPool({pids: [['101','303'], ['202']]});
  const result = await runCivicStagingSessionCheck(approved, {
    createPool: () => mismatch.pool,
  });
  assert.equal(result.result, 'UNSAFE_AFFINITY_OBSERVED');
  assert.equal(result.compatible, false);
  assert.equal(mismatch.ended, 1);

  const failed = syntheticPool({throwError: true});
  await assert.rejects(
    runCivicStagingSessionCheck(approved, {createPool: () => failed.pool}),
    err => err.message === 'CIVIC_SESSION_PROBE_UNAVAILABLE' &&
      !err.message.includes('ci-FakePass')
  );
  assert.equal(failed.ended, 1);
});
