'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  INGEST_URL, QUERY_URL, MAX_READBACK_ATTEMPTS, assertStagingDrillEnvironment,
  tabularReadbackContainsId, runAxiomStagingProviderDrill
} = require('../services/axiomStagingProviderDrill');

const env = Object.freeze({
  AXIOM_STAGING_DRILL_ARMED: 'true',
  AXIOM_STAGING_DRILL_TOKEN: 'synthetic-token-only',
  AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'staging',
  AXIOM_REALTIME_DATASET: 'demos-security-staging',
  AXIOM_DATASET: 'demos-security-staging',
  AXIOM_REGION: 'eu',
  AUDIT_OUTBOX_ENABLED: 'false',
  AUDIT_OUTBOX_WORKER_ENABLED: 'false',
  AXIOM_ARCHIVE_ENABLED: 'false'
});
const id = '123e4567-e89b-42d3-a456-426614174000';
test('edge readback explicitly bypasses provider caches and has bounded retry budget', () => {
  assert.equal(QUERY_URL,
    'https://eu-central-1.aws.edge.axiom.co/v1/query/_apl?format=tabular&nocache=true');
  assert.equal(MAX_READBACK_ATTEMPTS, 5);
});

const matched = {
  tables: [{ fields: [{ name: 'axiom_delivery_id', type: 'string' }],
    columns: [[id]] }]
};

test('no credential, production scope, privileged service secrets or worker flags means zero requests', async () => {
  const bad = [
    { AXIOM_STAGING_DRILL_ARMED: 'false' },
    { AXIOM_STAGING_DRILL_TOKEN: '' },
    { AXIOM_STAGING_DRILL_TOKEN: 'line\nbreak' },
    { AXIOM_REALTIME_DATASET: 'real-time' },
    { AXIOM_DATASET: 'centralized_logs' },
    { AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'production' },
    { AXIOM_REGION: 'us' },
    { AXIOM_EDGE_DOMAIN: 'malicious.test' },
    { DATABASE_URL: 'private-database' },
    { AUDIT_OUTBOX_DATABASE_URL: 'private-staging-database' },
    { AXIOM_API_TOKEN: 'production-secret' },
    { AXIOM_ORG_ID: 'production-org' },
    { B2_S3_SECRET_ACCESS_KEY: 'production-b2' },
    { AUDIT_OUTBOX_ENABLED: 'true' },
    { AUDIT_OUTBOX_WORKER_ENABLED: 'true' },
    { AXIOM_ENABLED: 'true' },
    { CI: 'true' }
  ];
  for (const changes of bad) {
    let contacted = false;
    await assert.rejects(
      runAxiomStagingProviderDrill({
        env: { ...env, ...changes },
        post: async () => { contacted = true; throw new Error('private'); }
      }), /AXIOM_STAGING_DRILL_ENV_REJECTED/);
    assert.equal(contacted, false);
  }
  assert.equal(assertStagingDrillEnvironment(env), true);
});

test('one synthetic event only, Axiom EU edge ingest then edge query, exact UUID readback', async () => {
  const calls = [];
  const result = await runAxiomStagingProviderDrill({
    env, uuid: () => id, now: () => new Date('2026-10-22T11:30:00.000Z'),
    sleep: async ms => { assert.equal(ms, 1000); calls.push('wait'); },
    post: async (url, body, opts) => {
      calls.push(url);
      assert.equal(opts.proxy, false);
      assert.equal(opts.maxRedirects, 0);
      assert.equal(opts.headers.Authorization, 'Bearer synthetic-token-only');
      assert.equal(opts.timeout, 5000);
      if (url === INGEST_URL) {
        assert.equal(body.length, 1);
        assert.deepEqual(Object.keys(body[0]).sort(),
          ['_time','action','axiom_delivery_id','log_type','resource','success','synthetic'].sort());
        assert.equal(body[0].synthetic, true);
        assert.equal(body[0].axiom_delivery_id, id);
        return { status: 200, data: { ingested: 1, failed: 0 } };
      }
      assert.equal(url, QUERY_URL);
      assert.equal(body.apl, "['demos-security-staging'] | where axiom_delivery_id == '" +
        id + "' | project axiom_delivery_id | take 1");
      return calls.includes('wait')
        ? { status: 200, data: matched }
        : { status: 200, data: { tables: [] } };
    }
  });
  assert.deepEqual(result, {
    status: 'AXIOM_STAGING_PROVIDER_E2E_VERIFIED', ingested: 1,
    matched: true, attempts: 2
  });
  assert.deepEqual(calls, [INGEST_URL, QUERY_URL, 'wait', QUERY_URL]);
  assert.ok(!JSON.stringify(result).includes(id));
});

test('stale empty readback retries only fresh queries, then verifies on last attempt', async () => {
  let ingests = 0, queries = 0;
  const delays = [];
  const result = await runAxiomStagingProviderDrill({
    env, uuid: () => id,
    now: () => new Date('2026-10-22T11:30:00.000Z'),
    sleep: async ms => delays.push(ms),
    post: async (url) => {
      if (url === INGEST_URL) {
        ingests++;
        return { status: 200, data: { ingested: 1, failed: 0 } };
      }
      assert.equal(url, QUERY_URL);
      queries++;
      return queries === MAX_READBACK_ATTEMPTS
        ? { status: 200, data: matched }
        : { status: 200, data: { tables: [] } };
    }
  });
  assert.equal(ingests, 1, 'ingest must never retry on empty readback');
  assert.equal(queries, MAX_READBACK_ATTEMPTS);
  assert.deepEqual(delays, [1000, 2000, 4000, 8000]);
  assert.equal(result.attempts, MAX_READBACK_ATTEMPTS);
  assert.equal(result.matched, true);
});

test('tabular readback cannot pass via echoed query, wrong columns or foreign id', () => {
  assert.equal(tabularReadbackContainsId({ request: { apl: id }, tables: [] }, id), false);
  assert.equal(tabularReadbackContainsId({ tables: [
    { fields: [{ name: 'message' }], columns: [[id]] }
  ] }, id), false);
  assert.equal(tabularReadbackContainsId({ tables: [
    { fields: [{ name: 'axiom_delivery_id' }], columns: [['different-id']] }
  ] }, id), false);
  assert.equal(tabularReadbackContainsId(matched, id), true);
  assert.equal(tabularReadbackContainsId(null, id), false);
});

test('partial ingest, provider faults, and absent readback fail closed without resending or leaking', async () => {
  for (const scenario of ['partial', 'error', 'missing', 'query403']) {
    let sends = 0, readQueries = 0, slept = 0;
    const post = async url => {
      if (url === INGEST_URL) {
        sends++;
        if (scenario === 'error') throw new Error('Bearer PRIVATE_TOKEN');
        if (scenario === 'partial') return {
          status: 200, data: { ingested: 0, failed: 1 }
        };
        return { status: 200, data: { ingested: 1, failed: 0 } };
      }
      readQueries++;
      return scenario === 'query403'
        ? { status: 403, data: { secret: 'PRIVATE' } }
        : { status: 200, data: { tables: [] } };
    };
    await assert.rejects(runAxiomStagingProviderDrill({
      env, post, uuid: () => id,
      now: () => new Date('2026-10-22T11:30:00.000Z'),
      sleep: async () => { slept++; }
    }), error => error.message === 'AXIOM_STAGING_PROVIDER_E2E_NOT_VERIFIED');
    assert.equal(sends, 1);
    assert.equal(readQueries, scenario === 'missing' ? MAX_READBACK_ATTEMPTS :
      scenario === 'query403' ? 1 : 0);
    assert.equal(slept, scenario === 'missing' ? MAX_READBACK_ATTEMPTS - 1 : 0);
  }
});
