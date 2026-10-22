'use strict';

// One-shot, explicitly armed and isolated HTTP provider drill. Never opens
// DEMOS DB connections or starts the audit worker. No real user event fields.
const { randomUUID } = require('node:crypto');
const { assertStagingSyntheticOutboxEvent, assertStagingAxiomHttpTarget } =
  require('./auditOutboxAxiomTarget');

const HOST = 'eu-central-1.aws.edge.axiom.co';
const DATASET = 'demos-security-staging';
const INGEST_URL = 'https://' + HOST + '/v1/ingest/' + DATASET;
const QUERY_URL = 'https://' + HOST + '/v1/query/_apl?format=tabular';
const BLOCKED_SECRETS = [
  'DATABASE_URL', 'AUDIT_OUTBOX_DATABASE_URL', 'AXIOM_API_TOKEN',
  'AXIOM_ORG_ID', 'B2_S3_SECRET_ACCESS_KEY', 'B2_APPLICATION_KEY',
  'FIREBASE_PRIVATE_KEY'
];
const BLOCKED_TRUE_FLAGS = [
  'AUDIT_OUTBOX_ENABLED', 'AUDIT_OUTBOX_WORKER_ENABLED',
  'AUDIT_OUTBOX_SECURITY_ENABLED', 'AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED',
  'AXIOM_ARCHIVE_ENABLED', 'AXIOM_ENABLED'
];

function assertStagingDrillEnvironment(env = process.env) {
  // Dedicated API token MUST be independently confirmed to have only
  // dataset-scoped Ingest:create and Query:read capabilities in Axiom.
  // Neither the CLI nor its tests can inspect the actual server-side grants.
  if (env.AXIOM_STAGING_DRILL_ARMED !== 'true' ||
      env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE !== 'staging' ||
      env.AXIOM_REALTIME_DATASET !== DATASET ||
      env.AXIOM_DATASET !== DATASET ||
      !env.AXIOM_STAGING_DRILL_TOKEN ||
      typeof env.AXIOM_STAGING_DRILL_TOKEN !== 'string' ||
      env.AXIOM_STAGING_DRILL_TOKEN.length > 4096 ||
      /[\r\n]/.test(env.AXIOM_STAGING_DRILL_TOKEN) ||
      env.CI === 'true' ||
      BLOCKED_SECRETS.some(key => Boolean(env[key])) ||
      BLOCKED_TRUE_FLAGS.some(key => env[key] === 'true')) {
    throw new Error('AXIOM_STAGING_DRILL_ENV_REJECTED');
  }
  try {
    if (assertStagingAxiomHttpTarget(env, 'staging') !== HOST) {
      throw new Error('WRONG_HOST');
    }
  } catch (_) {
    throw new Error('AXIOM_STAGING_DRILL_ENV_REJECTED');
  }
  return true;
}

function tabularReadbackContainsId(result, id) {
  // Axiom tabular tables contain fields[] and column-wise columns[][].
  // Inspect only the selected synthetic ID field; never scan arbitrary data.
  if (!Array.isArray(result?.tables)) return false;
  return result.tables.some(table => {
    if (!Array.isArray(table?.fields) || !Array.isArray(table?.columns)) {
      return false;
    }
    const index = table.fields.findIndex(field => field?.name === 'axiom_delivery_id');
    return index >= 0 && Array.isArray(table.columns[index]) &&
      table.columns[index].some(value => value === id);
  });
}

async function runAxiomStagingProviderDrill({
  env = process.env,
  post = (...args) => require('axios').post(...args),
  uuid = randomUUID,
  now = () => new Date(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  // Must reject before generating an event, connecting, or reading secrets.
  assertStagingDrillEnvironment(env);
  const id = uuid();
  if (typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('AXIOM_STAGING_DRILL_ID_REJECTED');
  }
  const start = now();
  if (!(start instanceof Date) || !Number.isFinite(start.getTime())) {
    throw new Error('AXIOM_STAGING_DRILL_CLOCK_REJECTED');
  }
  const event = {
    _time: start.toISOString(),
    log_type: 'audit',
    action: 'STAGING_OUTBOX_DRILL',
    resource: 'outbox',
    success: true,
    synthetic: true,
    axiom_delivery_id: id
  };
  assertStagingSyntheticOutboxEvent(event, 'staging');
  const headers = {
    Authorization: 'Bearer ' + env.AXIOM_STAGING_DRILL_TOKEN,
    'Content-Type': 'application/json'
  };
  const opts = {
    headers, timeout: 5000, proxy: false, maxRedirects: 0,
    maxBodyLength: 2048, maxContentLength: 131072
  };
  const apl = "['" + DATASET + "'] | where axiom_delivery_id == '" +
    id + "' | project axiom_delivery_id | take 1";
  const query = {
    apl, startTime: new Date(start.getTime() - 60000).toISOString(),
    endTime: new Date(start.getTime() + 300000).toISOString()
  };

  try {
    // Never resend after an ambiguous timeout: at-least-once duplicates can
    // otherwise be mistaken for a successful single-delivery drill.
    const ack = await post(INGEST_URL, [event], opts);
    if (![200, 202].includes(ack?.status) ||
        ack?.data?.ingested !== 1 || ack?.data?.failed !== 0) {
      throw new Error('INGEST_NOT_ACKNOWLEDGED');
    }

    // Allow short Axiom ingestion propagation; only the read-side query retries.
    for (let attempt = 0; attempt < 3; attempt++) {
      const read = await post(QUERY_URL, query, opts);
      if (read?.status !== 200) throw new Error('QUERY_NOT_ACKNOWLEDGED');
      if (tabularReadbackContainsId(read.data, id)) {
        return { status: 'AXIOM_STAGING_PROVIDER_E2E_VERIFIED', ingested: 1,
          matched: true, attempts: attempt + 1 };
      }
      if (attempt < 2) await sleep(1000);
    }
    throw new Error('READBACK_NOT_FOUND');
  } catch (_) {
    // Never include token, provider errors, query body, event id or payload.
    throw new Error('AXIOM_STAGING_PROVIDER_E2E_NOT_VERIFIED');
  }
}

module.exports = {
  HOST, DATASET, INGEST_URL, QUERY_URL, assertStagingDrillEnvironment,
  tabularReadbackContainsId, runAxiomStagingProviderDrill
};
