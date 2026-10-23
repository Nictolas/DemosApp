const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const auditServicePath = require.resolve('../services/auditService');
const originalLoad = Module._load;
// The audit writer imports an eager production database pool; replace only that
// direct import so this test cannot connect to Supabase or require real secrets.
Module._load = function (request, parent, isMain) {
  if (request === '../middleware/auth' && parent?.filename === auditServicePath) {
    return { pool: { query: async () => { throw new Error('Unexpected database call'); } } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
let AuditService;
try {
  AuditService = require('../services/auditService');
} finally {
  Module._load = originalLoad;
}
const axios = require('axios');

async function withStubbedAxiom(stub, fn) {
  const keys = ['AXIOM_ENABLED', 'AXIOM_API_TOKEN', 'AXIOM_ORG_ID', 'AXIOM_REGION', 'AXIOM_REALTIME_DATASET'];
  const previousEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const previousPost = axios.post;
  process.env.AXIOM_ENABLED = 'true';
  process.env.AXIOM_API_TOKEN = 'ci-example-token';
  process.env.AXIOM_ORG_ID = 'ci-example-org';
  process.env.AXIOM_REGION = 'eu';
  process.env.AXIOM_REALTIME_DATASET = 'real-time';
  axios.post = stub;
  try {
    return await fn();
  } finally {
    axios.post = previousPost;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('audit action is acknowledged only after HTTP ingest and payload is minimized', async () => {
  let captured;
  await withStubbedAxiom(async (...args) => {
    captured = args;
    return { status: 200 };
  }, async () => {
    const saved = await AuditService.logAction({
      userId: 'user-123',
      action: 'CONSENT_CHANGE',
      resource: 'political_opinions',
      details: { sensitivePoliticalPreference: 'private' },
      errorMessage: 'Email alice@example.com is invalid'
    });
    assert.ok(saved?.id?.startsWith('axiom-'));
  });
  const [url, payload] = captured;
  assert.match(url, /^https:\/\/eu-central-1\.aws\.edge\.axiom\.co\/v1\/ingest\/real-time$/);
  assert.equal(payload.length, 1);
  assert.equal(payload[0].log_type, 'audit');
  assert.equal(payload[0].action, 'CONSENT_CHANGE');
  assert.equal(payload[0].session_id, null);
  assert.equal(payload[0].error_message, null);
  assert.ok(!JSON.stringify(payload).includes('private'));
  assert.ok(!JSON.stringify(payload).includes('alice@example.com'));
});

test('audit writer returns null when HTTP ingest fails, never reporting false success', async () => {
  await withStubbedAxiom(async () => {
    const error = new Error('secret query rejected');
    error.response = { status: 403 };
    throw error;
  }, async () => {
    const saved = await AuditService.logAction({
      userId: 'user-999',
      action: 'DATA_ACCESS',
      resource: 'users'
    });
    assert.equal(saved, null);
  });
});

test('missing Axiom credentials cannot be mistaken for delivery', async () => {
  await withStubbedAxiom(async () => {
    throw new Error('Should not be called without credentials');
  }, async () => {
    delete process.env.AXIOM_API_TOKEN;
    const saved = await AuditService.logAction({
      userId: 'user-999',
      action: 'DATA_ACCESS',
      resource: 'users'
    });
    assert.equal(saved, null);
  });
});

async function withEnabledOutbox(outbox, fn) {
  const original = AuditService._auditOutbox;
  const flag = process.env.AUDIT_OUTBOX_ENABLED;
  AuditService._auditOutbox = outbox;
  process.env.AUDIT_OUTBOX_ENABLED = 'true';
  try {
    return await fn();
  } finally {
    AuditService._auditOutbox = original;
    if (flag === undefined) delete process.env.AUDIT_OUTBOX_ENABLED;
    else process.env.AUDIT_OUTBOX_ENABLED = flag;
  }
}

test('outbox mode persists prepared audit event and returns queued, not delivered', async () => {
  let queued;
  await withStubbedAxiom(async () => {
    throw new Error('No direct HTTP allowed in outbox mode');
  }, async () => withEnabledOutbox({
    enqueue: async (event, dataset) => {
      queued = { event, dataset };
      return '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f';
    }
  }, async () => {
    const result = await AuditService.logAction({
      userId: 'test-person',
      action: 'CONSENT_CHANGE',
      resource: 'users',
      details: { privatePoliticalOpinion: 'never persist me' },
      ipAddress: '192.0.2.55',
      errorMessage: 'Email foo@example.com is invalid'
    });
    assert.equal(result.delivery, 'queued');
    assert.match(result.id, /^outbox-/);
    assert.equal(queued.dataset, 'real-time');
    assert.equal(queued.event.log_type, 'audit');
    assert.equal(queued.event.user_id, 'test-person');
    assert.equal(queued.event.error_message, null);
    assert.ok(!JSON.stringify(queued).includes('never persist me'));
    assert.ok(!JSON.stringify(queued).includes('foo@example.com'));
  }));
});

test('outbox mode fails closed when database enqueue rejects', async () => {
  await withStubbedAxiom(async () => {
    throw new Error('Must not send directly');
  }, async () => withEnabledOutbox({
    enqueue: async () => { throw new Error('sensitive-DB-message'); }
  }, async () => {
    const saved = await AuditService.logAction({
      userId: 'test-person', action: 'DATA_ACCESS', resource: 'users'
    });
    assert.equal(saved, null);
  }));
});

test('outbox delivery retains the exact event, timestamp and deduplication key', async () => {
  const event = {
    _time: '2026-10-21T10:01:01.000Z',
    log_type: 'audit',
    action: 'CONSENT_CHANGE',
    resource: 'users',
    user_id: 'user-test',
    axiom_delivery_id: '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f'
  };
  let delivered;
  await withStubbedAxiom(async (url, payload) => {
    delivered = { url, payload };
    return { status: 200, data: { ingested: 1, failed: 0 } };
  }, async () => {
    assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP('real-time', event), true);
    assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP('real-time', event), true);
  });
  assert.equal(delivered.payload[0].axiom_delivery_id, event.axiom_delivery_id);
  assert.equal(delivered.payload[0]._time, event._time);
  assert.deepEqual(delivered.payload[0], event);
});

test('outbox HTTP only acknowledges a fully confirmed Axiom ingest, never a partial 2xx', async () => {
  const event = {
    _time: '2026-10-22T12:00:00.000Z',
    log_type: 'audit', action: 'DATA_ACCESS', resource: 'users',
    axiom_delivery_id: '123e4567-e89b-42d3-a456-426614174000'
  };
  let calls = 0;
  const bad = [
    { status: 200, data: { ingested: 0, failed: 1 } },
    { status: 200, data: { ingested: 1, failed: 1 } },
    { status: 202, data: { ingested: 0, failed: 0 } },
    { status: 200, data: { ingested: '1', failed: 0 } },
    { status: 200, data: { ingested: 1, failed: undefined } },
    { status: 200, data: undefined },
    { status: 204, data: { ingested: 1, failed: 0 } }
  ];
  await withStubbedAxiom(async (url, payload) => {
    assert.match(url, /\/v1\/ingest\/real-time$/);
    assert.equal(payload.length, 1);
    return bad[calls++];
  }, async () => {
    for (let i = 0; i < bad.length; i++) {
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP('real-time', event), false);
    }
  });
  assert.equal(calls, bad.length);
  for (const status of [200, 202]) {
    await withStubbedAxiom(async () => ({ status, data: { ingested: 1, failed: 0 } }), async () => {
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP('real-time', event), true);
    });
  }
});

test('outbox preprocessor applies configured anonymization before persistent storage', async () => {
  const prev = {
    AXIOM_ANONYMIZE: process.env.AXIOM_ANONYMIZE,
    AXIOM_ANONYMIZE_USER_ID: process.env.AXIOM_ANONYMIZE_USER_ID,
    EXPORT_HASH_SALT: process.env.EXPORT_HASH_SALT
  };
  process.env.AXIOM_ANONYMIZE = 'true';
  process.env.AXIOM_ANONYMIZE_USER_ID = 'true';
  process.env.EXPORT_HASH_SALT = 'unit-test-salt';
  let persisted;
  try {
    await withStubbedAxiom(async () => {
      throw new Error('must queue instead of direct post');
    }, async () => withEnabledOutbox({
      enqueue: async event => {
        persisted = event;
        return '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f';
      }
    }, () => AuditService.logAction({
      userId: 'sensitive-user-id',
      ipAddress: '198.51.100.22',
      action: 'DATA_ACCESS',
      resource: 'users'
    })));
    assert.equal(persisted.ip_address, '198.51.100.0');
    assert.notEqual(persisted.user_id, 'sensitive-user-id');
    assert.match(persisted.user_id, /^[0-9a-f]{16}$/);
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});


test('staging Axiom HTTP dispatch refuses foreign hosts before network and disables proxies/redirects', async () => {
  const keys = ['AUDIT_OUTBOX_DEPLOYMENT_SCOPE','AXIOM_REGION','AXIOM_EDGE_DOMAIN'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const event = {
    _time: '2026-10-22T12:00:00.000Z', log_type: 'audit',
    action: 'STAGING_OUTBOX_DRILL', resource: 'outbox',
    synthetic: true, success: true
  };
  let sent = 0;
  try {
    await withStubbedAxiom(async (url, payload, options) => {
      sent++;
      assert.equal(url,
        'https://eu-central-1.aws.edge.axiom.co/v1/ingest/demos-security-staging');
      assert.equal(options.proxy, false);
      assert.equal(options.maxRedirects, 0);
      assert.equal(payload[0].synthetic, true);
      return { status: 202, data: { ingested: 1, failed: 0 } };
    }, async () => {
      process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE = 'staging';
      for (const [region, edge] of [
        ['us', undefined],
        ['eu', 'example.invalid'],
        ['eu', 'https://eu-central-1.aws.edge.axiom.co'],
        ['eu', 'eu-central-1.aws.edge.axiom.co.evil.test']
      ]) {
        process.env.AXIOM_REGION = region;
        if (edge === undefined) delete process.env.AXIOM_EDGE_DOMAIN;
        else process.env.AXIOM_EDGE_DOMAIN = edge;
        assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP(
          'demos-security-staging', event), false);
        assert.equal(sent, 0, 'no token may be sent to a wrong endpoint');
      }
      process.env.AXIOM_REGION = 'eu';
      delete process.env.AXIOM_EDGE_DOMAIN;
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP(
        'demos-security-staging', event), true);
      assert.equal(sent, 1);
      process.env.AXIOM_EDGE_DOMAIN = 'eu-central-1.aws.edge.axiom.co';
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP(
        'demos-security-staging', event), true);
      assert.equal(sent, 2);
    });
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('outbox HTTP worker never crosses Axiom staging/production dataset boundaries', async () => {
  const oldScope = process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE;
  const event = {
    _time: '2026-10-21T12:00:00.000Z',
    log_type: 'audit',
    action: 'STAGING_OUTBOX_DRILL',
    resource: 'outbox',
    success: true,
    synthetic: true,
    axiom_delivery_id: '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f'
  };
  let requests = 0;
  try {
    await withStubbedAxiom(async (url) => {
      requests++;
      assert.match(url, /\/v1\/ingest\//);
      return { status: 202, data: { ingested: 1, failed: 0 } };
    }, async () => {
      process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE = 'staging';
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP('real-time', event), false);
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP('centralized_logs', event), false);
      assert.equal(requests, 0, 'staging must not contact live Axiom datasets');
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP(
        'demos-security-staging', { ...event, synthetic: undefined }), false);
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP(
        'demos-security-staging', { ...event, user_id: 'personal-id' }), false);
      assert.equal(requests, 0, 'unmarked or personal-data events never touch Axiom');
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP('demos-security-staging', event), true);
      assert.equal(requests, 1, 'the existing isolated staging dataset is allowed');

      process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE = 'production';
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP('demos-security-staging', event), false);
      assert.equal(requests, 1, 'production must not contact the staging dataset');
      assert.equal(await AuditService.sendPreparedAuditEventToAxiomHTTP('real-time', event), true);
      assert.equal(requests, 2);
    });
  } finally {
    if (oldScope === undefined) delete process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE;
    else process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE = oldScope;
  }
});
