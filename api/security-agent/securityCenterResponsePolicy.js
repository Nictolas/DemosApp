const MAX_DEPTH = 10;
const MAX_ARRAY_ITEMS = 200;
const MAX_OBJECT_KEYS = 128;
const MAX_STRING_LENGTH = 4096;
const MAX_KEY_LENGTH = 80;

const FAIL_CLOSED_BOOLEAN_KEYS = new Set([
  'authorized',
  'executable',
  'actionRunnerAvailable',
  'executionEnabled',
  'realDeliveryEnabled'
]);

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const RESPONSE_CONTRACTS = Object.freeze({
  overview: Object.freeze({ type: 'object', maxBytes: 128 * 1024 }),
  incidents: Object.freeze({ type: 'array', maxBytes: 128 * 1024 }),
  health: Object.freeze({ type: 'object', maxBytes: 64 * 1024 }),
  notifications: Object.freeze({ type: 'object', maxBytes: 128 * 1024 }),
  boundaryAudit: Object.freeze({ type: 'object', maxBytes: 128 * 1024 }),
  approvals: Object.freeze({ type: 'object', maxBytes: 256 * 1024 }),
  aiPolicy: Object.freeze({ type: 'object', maxBytes: 128 * 1024 }),
  aiOrchestrator: Object.freeze({ type: 'object', maxBytes: 128 * 1024 }),
  aiAnalyses: Object.freeze({ type: 'object', maxBytes: 256 * 1024 })
});

function fail() {
  throw new Error('SECURITY_CENTER_RESPONSE_CONTRACT_VIOLATION');
}

function assertJsonValue(value, { depth = 0, seen = new WeakSet(), key = null } = {}) {
  if (depth > MAX_DEPTH) fail();
  if (value === null) return;

  const type = typeof value;
  if (type === 'string') {
    if (value.length > MAX_STRING_LENGTH) fail();
    return;
  }
  if (type === 'number') {
    if (!Number.isFinite(value)) fail();
    return;
  }
  if (type === 'boolean') {
    if (key && FAIL_CLOSED_BOOLEAN_KEYS.has(key) && value === true) fail();
    return;
  }
  if (type !== 'object') fail();
  if (seen.has(value)) fail();
  seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) fail();
    for (const item of value) assertJsonValue(item, { depth: depth + 1, seen });
    seen.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail();
  const keys = Object.keys(value);
  if (keys.length > MAX_OBJECT_KEYS) fail();
  for (const childKey of keys) {
    if (childKey.length > MAX_KEY_LENGTH || FORBIDDEN_KEYS.has(childKey)) fail();
    assertJsonValue(value[childKey], { depth: depth + 1, seen, key: childKey });
  }
  seen.delete(value);
}

function validateSecurityCenterResponse(route, data) {
  const contract = RESPONSE_CONTRACTS[route];
  if (!contract) fail();
  if (contract.type === 'array' && !Array.isArray(data)) fail();
  if (contract.type === 'object' && (!data || Array.isArray(data) || typeof data !== 'object')) fail();

  assertJsonValue(data);
  const envelope = { success: true, data };
  const serialized = JSON.stringify(envelope);
  if (Buffer.byteLength(serialized, 'utf8') > contract.maxBytes) fail();
  return envelope;
}

module.exports = {
  MAX_DEPTH,
  MAX_ARRAY_ITEMS,
  MAX_OBJECT_KEYS,
  MAX_STRING_LENGTH,
  RESPONSE_CONTRACTS,
  validateSecurityCenterResponse
};
