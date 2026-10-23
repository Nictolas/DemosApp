'use strict';

// Opt-in staging-only one-shot: one synthetic enqueue, one real worker cycle,
// one Axiom delivery with exact ACK, then read-side retries only.
// Never launch this from the DEMOS API or on a production database.
const { createAuditOutbox } = require('./auditOutboxService');
const { createAuditOutboxWorker } = require('../jobs/auditOutboxWorker');
const { createAuditOutboxDatabase } = require('./auditOutboxDatabase');
const { normalizeReadonlyStagingUri } = require('../scripts/audit-outbox-readonly-health-server');
const { validateStagingOutboxTarget } = require('./auditOutboxStagingGuard');
const {
  STAGING_AXIOM_DATASET, STAGING_AXIOM_EDGE_DOMAIN,
  assertStagingSyntheticOutboxEvent, assertStagingAxiomHttpTarget
} = require('./auditOutboxAxiomTarget');
// A single matching UUID is not sufficient if the provider returned partial
// data, or if the same UUID has been ingested twice. Count the limited
// projected-ID result, never inspect unrelated fields or event payloads.
function countExactSyntheticMatches(result, id) {
  if (result?.status?.isPartial !== false ||
      !Array.isArray(result.tables)) return -1;
  let matches = 0;
  for (const table of result.tables) {
    if (!Array.isArray(table?.fields) || !Array.isArray(table?.columns)) {
      return -1;
    }
    const column = table.fields.findIndex(field => field?.name === 'axiom_delivery_id');
    if (column < 0 || !Array.isArray(table.columns[column])) return -1;
    matches += table.columns[column].filter(value => value === id).length;
  }
  return matches;
}

const DATASET = STAGING_AXIOM_DATASET;
const HOST = STAGING_AXIOM_EDGE_DOMAIN;
const INGEST = 'https://' + HOST + '/v1/ingest/' + DATASET;
const QUERY = 'https://' + HOST + '/v1/query/_apl?format=tabular&nocache=true';
const MAX_READS = 5;

function validToken(value) {
  return typeof value === 'string' && value.length >= 16 &&
    value.length <= 4096 && !/[\s]/.test(value);
}

function assertStagingWorkerDrillEnvironment(env = process.env) {
  const forbiddenSecrets = [
    'DATABASE_URL', 'AXIOM_API_TOKEN', 'AXIOM_ORG_ID',
    'AXIOM_STAGING_DRILL_TOKEN', 'B2_S3_SECRET_ACCESS_KEY',
    'B2_APPLICATION_KEY', 'FIREBASE_PRIVATE_KEY'
  ];
  const disabledFlags = [
    'AUDIT_OUTBOX_ENABLED', 'AUDIT_OUTBOX_WORKER_ENABLED',
    'AUDIT_OUTBOX_SECURITY_ENABLED', 'AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED',
    'AXIOM_ARCHIVE_ENABLED', 'AXIOM_ENABLED'
  ];
  if (env.AUDIT_OUTBOX_STAGING_WORKER_DRILL_ARMED !== 'true' ||
      env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE !== 'staging' ||
      env.AUDIT_OUTBOX_PREFLIGHT_ONLY !== 'true' ||
      env.AXIOM_DATASET !== DATASET || env.AXIOM_REALTIME_DATASET !== DATASET ||
      env.CI === 'true' || env.GITHUB_ACTIONS === 'true' ||
      forbiddenSecrets.some(key => Boolean(env[key])) ||
      disabledFlags.some(key => env[key] === 'true') ||
      !validToken(env.AXIOM_STAGING_DRILL_INGEST_TOKEN) ||
      !validToken(env.AXIOM_STAGING_DRILL_QUERY_TOKEN) ||
      env.AXIOM_STAGING_DRILL_INGEST_TOKEN === env.AXIOM_STAGING_DRILL_QUERY_TOKEN ||
      !env.AUDIT_OUTBOX_DATABASE_URL) {
    throw new Error('STAGING_WORKER_DRILL_ENV_REJECTED');
  }
  try {
    if (validateStagingOutboxTarget(env.AUDIT_OUTBOX_DATABASE_URL).mode !== 'session-pooler' ||
        assertStagingAxiomHttpTarget(env, 'staging') !== HOST) {
      throw new Error('INVALID_TARGET');
    }
  } catch (_) {
    throw new Error('STAGING_WORKER_DRILL_ENV_REJECTED');
  }
  return true;
}

function requestOptions(token) {
  return {
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    timeout: 5000, proxy: false, maxRedirects: 0,
    maxBodyLength: 2048, maxContentLength: 131072
  };
}

async function runStagingWorkerDrill({
  env = process.env,
  open = runtimeEnv => createAuditOutboxDatabase({ env: runtimeEnv, standalonePreflight: true }),
  makeOutbox = createAuditOutbox,
  makeWorker = createAuditOutboxWorker,
  post = (...args) => require('axios').post(...args),
  now = () => new Date(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  // An existing dedicated staging probe has already validated the exact
  // fixed-prefix/fixed-suffix password escaping rules. Reuse it without
  // weakening host, role, project, scope, or target validation.
  const runtimeEnv = {
    ...env,
    AUDIT_OUTBOX_DATABASE_URL: normalizeReadonlyStagingUri(env.AUDIT_OUTBOX_DATABASE_URL)
  };
  // Reject all bad environments BEFORE opening a pool or contacting Axiom.
  assertStagingWorkerDrillEnvironment(runtimeEnv);
  let pool;
  try {
    const db = open(runtimeEnv);
    if (!db || !db.pool || typeof db.ensureReady !== 'function') {
      throw new Error('STAGING_WORKER_DRILL_DATABASE_UNAVAILABLE');
    }
    pool = db.pool;
    await db.ensureReady();
    let expectedId = null;
    let sends = 0;
    const outbox = makeOutbox({
      pool, ensureReady: db.ensureReady,
      report: () => {}, maxRecords: 1,
      send: async (dataset, payload) => {
        if (++sends !== 1 || dataset !== DATASET ||
            !expectedId || payload?.axiom_delivery_id !== expectedId) {
          return false;
        }
        try {
          assertStagingSyntheticOutboxEvent(payload, 'staging');
          const ack = await post(INGEST, [payload],
            requestOptions(env.AXIOM_STAGING_DRILL_INGEST_TOKEN));
          return [200, 202].includes(ack?.status) &&
            ack?.data?.ingested === 1 && ack?.data?.failed === 0;
        } catch (_) {
          return false;
        }
      }
    });
    // Fail closed if any earlier drill left rows, including dead-letter.
    const before = await outbox.getHealth();
    if (before?.total !== 0 || before?.pending !== 0 ||
        before?.sending !== 0 || before?.deadLetter !== 0) {
      throw new Error('STAGING_WORKER_DRILL_QUEUE_NOT_EMPTY');
    }
    const start = now();
    if (!(start instanceof Date) || !Number.isFinite(start.getTime())) {
      throw new Error('STAGING_WORKER_DRILL_CLOCK_INVALID');
    }
    const event = {
      _time: start.toISOString(), log_type: 'audit',
      action: 'STAGING_OUTBOX_DRILL', resource: 'outbox',
      success: true, synthetic: true
    };
    assertStagingSyntheticOutboxEvent(event, 'staging');
    expectedId = await outbox.enqueue(event, DATASET);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedId)) {
      throw new Error('STAGING_WORKER_DRILL_ID_INVALID');
    }
    // The actual worker code is invoked directly ONCE: no scheduler, startup
    // flag, recurring job, second send or hidden worker activation.
    const worker = makeWorker({
      outbox, enabled: () => true, report: () => {},
      notifyAdmin: null
    });
    const stats = await worker.runOnce();
    if (sends !== 1 || stats?.claimed !== 1 || stats?.delivered !== 1 ||
        stats?.rescheduled !== 0 || stats?.deadLettered !== 0 ||
        (await outbox.getHealth())?.total !== 0) {
      throw new Error('STAGING_WORKER_DRILL_ACK_NOT_CONFIRMED');
    }
    const query = {
      apl: "['" + DATASET + "'] | where axiom_delivery_id == '" +
        expectedId + "' | project axiom_delivery_id | take 2",
      startTime: new Date(start.getTime() - 60000).toISOString(),
      endTime: new Date(start.getTime() + 900000).toISOString()
    };
    // Only query/readback is retried. Never enqueue or ingest a second time.
    for (let attempt = 0; attempt < MAX_READS; attempt++) {
      let response;
      try {
        response = await post(QUERY, query,
          requestOptions(env.AXIOM_STAGING_DRILL_QUERY_TOKEN));
      } catch (_) {
        throw new Error('STAGING_WORKER_DRILL_READBACK_UNVERIFIED');
      }
      if (response?.status !== 200) {
        throw new Error('STAGING_WORKER_DRILL_READBACK_UNVERIFIED');
      }
      const matches = countExactSyntheticMatches(response.data, expectedId);
      if (matches < 0 || matches > 1) {
        // Missing completeness metadata or two rows with the same synthetic
        // UUID: never certify single delivery. No second HTTP ingest.
        throw new Error('STAGING_WORKER_DRILL_READBACK_UNVERIFIED');
      }
      if (matches === 1) {
        return { status: 'STAGING_WORKER_OUTBOX_AXIOM_E2E_PASS',
          claimed: 1, delivered: 1, matched: true,
          readAttempts: attempt + 1 };
      }
      if (attempt + 1 < MAX_READS) await sleep(1000 * (2 ** attempt));
    }
    throw new Error('STAGING_WORKER_DRILL_READBACK_UNVERIFIED');
  } finally {
    if (pool && typeof pool.end === 'function') await pool.end();
  }
}

module.exports = {
  DATASET, HOST, INGEST, QUERY,
  assertStagingWorkerDrillEnvironment, countExactSyntheticMatches,
  runStagingWorkerDrill
};
