'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DATASET, INGEST, QUERY,
  assertStagingWorkerDrillEnvironment, runStagingWorkerDrill
} = require('../services/auditOutboxStagingWorkerDrill');

const REF = 'fkeayjzvtuvzesljhjbc';
const ID = 'fa4ae7d5-0fb7-4dc5-85d6-482cde13be21';
const base = Object.freeze({
  AUDIT_OUTBOX_STAGING_WORKER_DRILL_ARMED: 'true',
  AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'staging',
  AUDIT_OUTBOX_PREFLIGHT_ONLY: 'true',
  AUDIT_OUTBOX_DATABASE_URL: 'postgresql://demos_outbox_runtime.' + REF +
    ':not-a-real-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
  AXIOM_DATASET: DATASET, AXIOM_REALTIME_DATASET: DATASET,
  AXIOM_REGION: 'eu',
  AXIOM_STAGING_DRILL_INGEST_TOKEN: 'ingest-only-test-credential',
  AXIOM_STAGING_DRILL_QUERY_TOKEN: 'query-only-test-credential',
  AUDIT_OUTBOX_ENABLED: 'false',
  AUDIT_OUTBOX_WORKER_ENABLED: 'false',
  AXIOM_ARCHIVE_ENABLED: 'false'
});

test('staging-only guards reject all production secrets, flags and alternate DB targets BEFORE any connection', async () => {
  assert.equal(assertStagingWorkerDrillEnvironment(base), true);
  const refused = [
    { AUDIT_OUTBOX_STAGING_WORKER_DRILL_ARMED: 'false' },
    { AUDIT_OUTBOX_DEPLOYMENT_SCOPE: 'production' },
    { AUDIT_OUTBOX_PREFLIGHT_ONLY: 'false' },
    { DATABASE_URL: base.AUDIT_OUTBOX_DATABASE_URL },
    { AXIOM_API_TOKEN: 'production-key' },
    { AXIOM_ORG_ID: 'production-org' },
    { AXIOM_STAGING_DRILL_TOKEN: 'combined' },
    { B2_S3_SECRET_ACCESS_KEY: 'forbidden' },
    { FIREBASE_PRIVATE_KEY: 'forbidden' },
    { AUDIT_OUTBOX_ENABLED: 'true' },
    { AUDIT_OUTBOX_WORKER_ENABLED: 'true' },
    { AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED: 'true' },
    { AXIOM_ENABLED: 'true' },
    { AXIOM_ARCHIVE_ENABLED: 'true' },
    { CI: 'true' }, { GITHUB_ACTIONS: 'true' },
    { AXIOM_REGION: 'us' },
    { AXIOM_EDGE_DOMAIN: 'wrong.example' },
    { AXIOM_DATASET: 'real-time' },
    { AXIOM_REALTIME_DATASET: 'centralized_logs' },
    { AXIOM_STAGING_DRILL_INGEST_TOKEN: 'short' },
    { AXIOM_STAGING_DRILL_QUERY_TOKEN: base.AXIOM_STAGING_DRILL_INGEST_TOKEN },
    { AXIOM_STAGING_DRILL_QUERY_TOKEN: undefined },
    { AUDIT_OUTBOX_DATABASE_URL: base.AUDIT_OUTBOX_DATABASE_URL.replace(REF, 'wxnblcqoyjqxktwkcqok') },
    { AUDIT_OUTBOX_DATABASE_URL: base.AUDIT_OUTBOX_DATABASE_URL.replace(':5432/', ':6543/') }
  ];
  for (const change of refused) {
    let opened = 0;
    await assert.rejects(runStagingWorkerDrill({
      env: { ...base, ...change },
      open: () => { opened++; throw new Error('database must not open'); },
      post: async () => { throw new Error('network must not run'); }
    }), /STAGING_WORKER_DRILL_ENV_REJECTED/);
    assert.equal(opened, 0);
  }
});

function buildFake({ nonempty = false, ack = true, readback = true } = {}) {
  let queued = nonempty ? 1 : 0;
  let ingests = 0, queries = 0, enqueues = 0, closes = 0, opens = 0;
  let payload;
  const post = async (url, body, options) => {
    assert.equal(options.proxy, false);
    assert.equal(options.maxRedirects, 0);
    assert.equal(options.timeout, 5000);
    if (url === INGEST) {
      ingests++;
      assert.equal(options.headers.Authorization,
        'Bearer ' + base.AXIOM_STAGING_DRILL_INGEST_TOKEN);
      assert.equal(body.length, 1);
      assert.equal(body[0].axiom_delivery_id, ID);
      assert.equal(body[0].synthetic, true);
      assert.equal(body[0].action, 'STAGING_OUTBOX_DRILL');
      assert.ok(Object.keys(body[0]).every(field => ![
        'user_id', 'ip_address', 'details', 'error_message'
      ].includes(field)));
      return { status: 200, data: { ingested: ack ? 1 : 0, failed: ack ? 0 : 1 } };
    }
    assert.equal(url, QUERY);
    assert.equal(options.headers.Authorization,
      'Bearer ' + base.AXIOM_STAGING_DRILL_QUERY_TOKEN);
    queries++;
    assert.match(body.apl, new RegExp(ID));
    return { status: 200, data: { tables: [{
      fields: [{ name: 'axiom_delivery_id' }],
      columns: [readback ? [ID] : []]
    }] } };
  };
  const makeOutbox = ({ send, ensureReady, maxRecords }) => {
    assert.equal(typeof ensureReady, 'function');
    assert.equal(maxRecords, 1);
    return {
      getHealth: async () => ({
        total: queued, pending: queued, sending: 0, deadLetter: 0
      }),
      enqueue: async (event, dataset) => {
        enqueues++;
        assert.equal(dataset, DATASET);
        assert.equal(queued, 0);
        payload = { ...event, axiom_delivery_id: ID };
        queued = 1;
        return ID;
      },
      drainOnce: async () => {
        const success = await send(DATASET, payload);
        if (success) queued = 0;
        return { claimed: 1, delivered: success ? 1 : 0,
          rescheduled: success ? 0 : 1, deadLettered: 0 };
      }
    };
  };
  return {
    post, makeOutbox,
    open: () => {
      opens++;
      return { pool: { end: async () => { closes++; } },
        ensureReady: async () => {} };
    },
    counts: () => ({ queued, ingests, queries, enqueues, opens, closes }),
    now: () => new Date('2026-10-23T10:00:00.000Z'),
    sleep: async () => {}
  };
}

test('one enqueue -> exactly one real worker cycle -> one Axiom ingest -> matching readback', async () => {
  const fake = buildFake();
  const result = await runStagingWorkerDrill({ env: base, ...fake });
  assert.deepEqual(result, {
    status: 'STAGING_WORKER_OUTBOX_AXIOM_E2E_PASS',
    claimed: 1, delivered: 1, matched: true, readAttempts: 1
  });
  assert.deepEqual(fake.counts(), {
    queued: 0, ingests: 1, queries: 1, enqueues: 1, opens: 1, closes: 1
  });
});

test('already populated staging queue is rejected before enqueue or provider calls', async () => {
  const fake = buildFake({ nonempty: true });
  await assert.rejects(runStagingWorkerDrill({ env: base, ...fake }),
    /STAGING_WORKER_DRILL_QUEUE_NOT_EMPTY/);
  assert.deepEqual(fake.counts(), {
    queued: 1, ingests: 0, queries: 0, enqueues: 0, opens: 1, closes: 1
  });
});

test('provider says failed even on HTTP 200: do not acknowledge or resend', async () => {
  const fake = buildFake({ ack: false });
  await assert.rejects(runStagingWorkerDrill({ env: base, ...fake }),
    /STAGING_WORKER_DRILL_ACK_NOT_CONFIRMED/);
  assert.deepEqual(fake.counts(), {
    queued: 1, ingests: 1, queries: 0, enqueues: 1, opens: 1, closes: 1
  });
});

test('missing readback polls only queries and never resends the event', async () => {
  const fake = buildFake({ readback: false });
  await assert.rejects(runStagingWorkerDrill({ env: base, ...fake }),
    /STAGING_WORKER_DRILL_READBACK_UNVERIFIED/);
  assert.deepEqual(fake.counts(), {
    queued: 0, ingests: 1, queries: 5, enqueues: 1, opens: 1, closes: 1
  });
});
