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
