const test = require('node:test');
const assert = require('node:assert/strict');
const { RESPONSE_CONTRACTS, validateSecurityCenterResponse } = require('../security-agent/securityCenterResponsePolicy');
const { createSecurityCenterHandlers } = require('../security-agent/securityCenterApi');

function res() {
  return { code: 200, body: null, status(n) { this.code = n; return this; }, json(x) { this.body = x; return x; } };
}

function service(extra = {}) {
  return {
    getOverview: async () => ({}),
    listIncidents: async () => [],
    getHealth: async () => ({}),
    ...extra
  };
}

test('response contracts cover every Security Center handler', () => {
  assert.deepEqual(Object.keys(RESPONSE_CONTRACTS).sort(), ['aiAnalyses','aiOrchestrator','aiPolicy','approvals','boundaryAudit','health','incidents','notifications','overview'].sort());
});

test('valid object and array responses receive the fixed success envelope', () => {
  assert.deepEqual(validateSecurityCenterResponse('health', { state: 'ok' }), { success: true, data: { state: 'ok' } });
  assert.deepEqual(validateSecurityCenterResponse('incidents', [{ incidentId: 'inc_1' }]), { success: true, data: [{ incidentId: 'inc_1' }] });
});

test('route data types fail closed', () => {
  assert.throws(() => validateSecurityCenterResponse('incidents', {}), /CONTRACT_VIOLATION/);
  assert.throws(() => validateSecurityCenterResponse('health', []), /CONTRACT_VIOLATION/);
});

test('strings, arrays, object width and depth are bounded', () => {
  assert.throws(() => validateSecurityCenterResponse('health', { x: 'a'.repeat(4097) }), /CONTRACT_VIOLATION/);
  assert.throws(() => validateSecurityCenterResponse('health', { x: Array.from({ length: 201 }, () => 1) }), /CONTRACT_VIOLATION/);
  assert.throws(() => validateSecurityCenterResponse('health', Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`k${i}`, i]))), /CONTRACT_VIOLATION/);
  let deep = {}; let cursor = deep; for (let i = 0; i < 11; i += 1) { cursor.next = {}; cursor = cursor.next; }
  assert.throws(() => validateSecurityCenterResponse('health', deep), /CONTRACT_VIOLATION/);
});

test('non JSON values, cycles and non-finite numbers are rejected', () => {
  assert.throws(() => validateSecurityCenterResponse('health', { x: undefined }), /CONTRACT_VIOLATION/);
  assert.throws(() => validateSecurityCenterResponse('health', { x: Number.NaN }), /CONTRACT_VIOLATION/);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => validateSecurityCenterResponse('health', cyclic), /CONTRACT_VIOLATION/);
});

test('shadow safety flags can never become true in a Security Center response', () => {
  for (const key of ['authorized', 'executable', 'actionRunnerAvailable', 'executionEnabled', 'realDeliveryEnabled']) {
    assert.throws(() => validateSecurityCenterResponse('health', { nested: { [key]: true } }), /CONTRACT_VIOLATION/, key);
  }
  assert.doesNotThrow(() => validateSecurityCenterResponse('health', { executable: false, actionRunnerAvailable: false }));
});

test('serialized response bytes are bounded per route', () => {
  const payload = { items: Array.from({ length: 40 }, () => 'x'.repeat(2000)) };
  assert.throws(() => validateSecurityCenterResponse('health', payload), /CONTRACT_VIOLATION/);
});

test('handler converts unsafe service output to the generic read failure', async () => {
  const handlers = createSecurityCenterHandlers(service({ getHealth: async () => ({ executionEnabled: true }) }));
  const r = res();
  await handlers.health({ query: {} }, r);
  assert.equal(r.code, 500);
  assert.deepEqual(r.body, { success: false, error: 'SECURITY_CENTER_READ_FAILED' });
});

test('handler converts oversized output to the generic read failure', async () => {
  const handlers = createSecurityCenterHandlers(service({ getHealth: async () => ({ items: Array.from({ length: 40 }, () => 'x'.repeat(2000)) }) }));
  const r = res();
  await handlers.health({ query: {} }, r);
  assert.equal(r.code, 500);
  assert.equal(r.body.error, 'SECURITY_CENTER_READ_FAILED');
});
