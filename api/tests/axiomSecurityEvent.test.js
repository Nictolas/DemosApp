'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { buildQueuedSecurityEvent, safeSecurityCode } = require('../utils/axiomSecurityEvent');

test('security outbox payload excludes arbitrary messages, URLs, body and query metadata', () => {
  const result = buildQueuedSecurityEvent({
    _time: '2026-10-21T10:00:00.000Z',
    log_type: 'security',
    message: 'Evento di sicurezza: alice@example.com&token=SECRET',
    endpoint: '/users/alice@example.com?secret=1',
    user_id: 'test-user',
    ip_address: '198.51.100.0'
  }, {
    securityCode: 'invalid@example.com',
    rawBody: 'password=secret',
    query: 'token'
  });
  assert.deepEqual(result, {
    _time: '2026-10-21T10:00:00.000Z',
    log_type: 'security', event_code: 'SECURITY_EVENT',
    user_id: 'test-user', ip_address: '198.51.100.0'
  });
  assert.equal(safeSecurityCode('BRUTE_FORCE_ATTEMPT'), 'BRUTE_FORCE_ATTEMPT');
  assert.equal(safeSecurityCode('hello@example.com'), null);
  assert.equal(buildQueuedSecurityEvent({
    log_type: 'security', message: 'Evento di sicurezza: Tentativo di attacco rilevato'
  }).event_code, 'SUSPICIOUS_REQUEST_PATTERN');
  assert.throws(() => buildQueuedSecurityEvent({ log_type: 'technical' }), /INVALID_CATEGORY/);
});

const loggerPath = require.resolve('../services/centralizedLogger');
async function withIsolatedLogger({
  queue, securityFlag = 'true', mainFlag = 'true'
}, fn) {
  const originalLoad = Module._load;
  const keys = ['AXIOM_ENABLED', 'AUDIT_OUTBOX_ENABLED', 'AUDIT_OUTBOX_SECURITY_ENABLED',
    'AXIOM_API_TOKEN', 'AXIOM_ORG_ID', 'AXIOM_ANONYMIZE',
    'AXIOM_ANONYMIZE_USER_ID', 'EXPORT_HASH_SALT'];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.AXIOM_ENABLED = 'true';
  process.env.AUDIT_OUTBOX_ENABLED = mainFlag;
  process.env.AUDIT_OUTBOX_SECURITY_ENABLED = securityFlag;
  process.env.AXIOM_API_TOKEN = 'ci-example-token';
  process.env.AXIOM_ORG_ID = 'ci-example-org';
  process.env.AXIOM_ANONYMIZE = 'true';
  process.env.AXIOM_ANONYMIZE_USER_ID = 'true';
  process.env.EXPORT_HASH_SALT = 'test-only';
  let logger;
  try {
    // No Supabase access: mock the module's eager production pool.
    Module._load = function(request, parent, isMain) {
      if (request === '../middleware/auth' && parent?.filename === loggerPath) {
        return { pool: { query: async () => { throw new Error('Unexpected Supabase query'); } } };
      }
      if (request === './auditService' && parent?.filename === loggerPath) {
        return { getAuditOutbox: () => queue };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    delete require.cache[loggerPath];
    logger = require('../services/centralizedLogger');
    logger.logToAxiom = true;
    logger.axiomDataset = 'centralized_logs';
    return await fn(logger);
  } finally {
    Module._load = originalLoad;
    delete require.cache[loggerPath];
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('explicit security log queues minimal event, never POSTs to Axiom twice', async () => {
  let queued;
  await withIsolatedLogger({
    queue: { enqueue: async (event, dataset) => {
      queued = { event, dataset };
      return '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f';
    }}
  }, async logger => {
    logger.sendToAxiomHTTP = async () => { throw new Error('DIRECT_AXIOM_MUST_NOT_BE_CALLED'); };
    await logger.writeToAxiom('WARN', 'Evento di sicurezza: Tentativo di attacco rilevato', {
      securityEvent: true,
      userId: 'sensitive-user',
      ipAddress: '198.51.100.22',
      endpoint: '/api/political-opinion?token=secret',
      body: 'user@example.com',
      securityCode: 'PATH_TRAVERSAL'
    });
  });
  assert.equal(queued.dataset, 'centralized_logs');
  assert.deepEqual(Object.keys(queued.event).sort(), ['_time', 'event_code',
    'ip_address', 'log_type', 'user_id']);
  assert.equal(queued.event.log_type, 'security');
  assert.equal(queued.event.event_code, 'PATH_TRAVERSAL');
  assert.equal(queued.event.ip_address, '198.51.100.0');
  assert.notEqual(queued.event.user_id, 'sensitive-user');
  assert.ok(!JSON.stringify(queued).includes('user@example.com'));
  assert.ok(!JSON.stringify(queued).includes('secret'));
});

test('without security flag, direct Axiom delivery remains unchanged', async () => {
  let direct;
  await withIsolatedLogger({
    securityFlag: 'false', queue: { enqueue: async () => { throw new Error('must not queue'); } }
  }, async logger => {
    logger.sendToAxiomHTTP = async (dataset, events) => { direct = { dataset, events }; };
    await logger.writeToAxiom('WARN', 'Evento di sicurezza: Tentativo di attacco rilevato', {
      securityEvent: true, userId: 'sensitive-user'
    });
  });
  assert.equal(direct.dataset, 'centralized_logs');
  assert.equal(direct.events[0].log_type, 'security');
});

test('queue rejection never triggers unsafe fallback to direct Axiom ingestion', async () => {
  let direct = 0;
  let attempts = 0;
  await withIsolatedLogger({
    queue: { enqueue: async () => {
      attempts++;
      throw new Error('DB failed with sensitive URL');
    }}
  }, async logger => {
    logger.sendToAxiomHTTP = async () => { direct++; };
    await logger.writeToAxiom('WARN', 'Evento di sicurezza: Tentativo di attacco rilevato', {
      securityEvent: true, userId: 'test-user'
    });
  });
  assert.equal(attempts, 1);
  assert.equal(direct, 0);
});
