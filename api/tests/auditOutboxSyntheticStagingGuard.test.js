'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertOutboxAxiomTarget,
  assertStagingSyntheticOutboxEvent
} = require('../services/auditOutboxAxiomTarget');
const { createAuditOutbox } = require('../services/auditOutboxService');

const synthetic = Object.freeze({
  _time: '2026-10-22T10:00:00.000Z',
  log_type: 'audit',
  synthetic: true,
  action: 'STAGING_OUTBOX_DRILL',
  resource: 'outbox',
  success: true
});

test('staging accepts only a clearly marked, strictly bounded synthetic audit drill', () => {
  assert.doesNotThrow(() => assertOutboxAxiomTarget('demos-security-staging', 'staging'));
  assert.equal(assertStagingSyntheticOutboxEvent(synthetic, 'staging'), true);
  assert.equal(assertStagingSyntheticOutboxEvent({
    ...synthetic,
    user_id: null, ip_address: null, session_id: null,
    resource_id: null, error_message: null,
    axiom_delivery_id: '123e4567-e89b-42d3-a456-426614174000'
  }, 'staging'), true);

  const rejects = [
    { ...synthetic, synthetic: false },
    { ...synthetic, synthetic: undefined },
    { ...synthetic, user_id: 'test-user' },
    { ...synthetic, ip_address: '192.0.2.1' },
    { ...synthetic, session_id: 'trace-one' },
    { ...synthetic, resource_id: '123' },
    { ...synthetic, error_message: 'email@example.com' },
    { ...synthetic, details: { token: 'sensitive' } },
    { ...synthetic, message: 'user-entered text' },
    { ...synthetic, action: 'DATA_ACCESS' },
    { ...synthetic, resource: 'users' },
    { ...synthetic, success: false },
    { ...synthetic, log_type: 'security' },
    { ...synthetic, _time: 'not-an-ISO-time' },
    { ...synthetic, axiom_delivery_id: 'malformed' }
  ];
  for (const event of rejects) {
    assert.throws(() => assertStagingSyntheticOutboxEvent(event, 'staging'),
      error => error.message === 'OUTBOX_STAGING_SYNTHETIC_ONLY');
  }
});

test('staging rejection occurs before any outbox database query', async () => {
  const orig = process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE;
  let queries = 0;
  try {
    process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE = 'staging';
    const outbox = createAuditOutbox({
      pool: {
        query: async () => { queries++; throw new Error('database must not be touched'); },
        connect: async () => { queries++; throw new Error('database must not be touched'); }
      },
      send: async () => { throw new Error('Axiom must not be touched'); }
    });
    await assert.rejects(outbox.enqueue({
      ...synthetic, user_id: 'private-user'
    }, 'demos-security-staging'), /OUTBOX_STAGING_SYNTHETIC_ONLY/);
    await assert.rejects(outbox.enqueue({
      ...synthetic, details: { secret: 'PRIVATE' }
    }, 'demos-security-staging'), /OUTBOX_STAGING_SYNTHETIC_ONLY/);
    assert.equal(queries, 0);
  } finally {
    if (orig === undefined) delete process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE;
    else process.env.AUDIT_OUTBOX_DEPLOYMENT_SCOPE = orig;
  }
});

test('production scope retains existing audit event schema and blocks staging dataset', () => {
  const productionEvent = {
    _time: '2026-10-22T10:00:00.000Z',
    log_type: 'audit',
    action: 'DATA_ACCESS',
    resource: 'users',
    user_id: 'real-user'
  };
  assert.equal(assertStagingSyntheticOutboxEvent(productionEvent, 'production'), true);
  assert.doesNotThrow(() => assertOutboxAxiomTarget('real-time', 'production'));
  assert.throws(() => assertOutboxAxiomTarget('demos-security-staging', 'production'),
    /OUTBOX_AXIOM_DATASET_SCOPE_REJECTED/);
});
