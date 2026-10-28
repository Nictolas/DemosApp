'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sealOffline, verifyOffline } =
  require('../services/gdprExternalEvidenceVerifier');

const KEY = Buffer.alloc(32, 7); // synthetic CI ONLY; never use for real archives
const OTHER_KEY = Buffer.alloc(32, 8);
const SOURCE = 'gdpr_synthetic_local';
const CAPTURED = '2026-10-27T18:45:00.000000Z';
const NOW = Date.UTC(2026, 9, 27, 18, 45, 30);
const EVENTS = [
  {
    event_key: 'synthetic-first', subject_user_id: 'synthetic-person-1',
    event_type: 'political_consent_revoked',
    occurred_at: '2026-10-27T18:43:00.123456Z',
    details: { source: 'ci', counts: { deleted: 3, choices: 2 } }
  },
  {
    event_key: 'synthetic-second', subject_user_id: 'synthetic-person-2',
    event_type: 'account_deleted',
    occurred_at: '2026-10-27T18:44:00.000001Z',
    details: { source: 'ci' }
  }
];
const sign = (events = EVENTS) =>
  sealOffline({ events, capturedAt: CAPTURED, source: SOURCE }, KEY);
const check = (bundle, more = {}) =>
  verifyOffline(bundle, {
    secret: KEY, expectedSignature: bundle.signature,
    expectedSource: SOURCE, now: NOW, ...more
  });
const fails = (fn, code) =>
  assert.throws(fn, error => error?.code === code);

test('offline signed synthetic capture verifies but never declares release or completeness', () => {
  const bundle = sign();
  const result = check(bundle);
  assert.equal(result.status, 'INTEGRITY_ONLY_NOT_RECOVERY_GO');
  assert.equal(result.eventCount, 2);
  assert.equal(result.externalAnchorVerified, true);
  assert.equal(result.externalLedgerCompletenessAttested, false);
  assert.equal(result.renderWriterAttested, false);
  assert.equal(result.recoveryApproved, false);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-person|synthetic-first|counts|choices/);
});

test('missing independent signature anchor or wrong signing key fails closed', () => {
  const bundle = sign();
  fails(() => verifyOffline(bundle, {
    secret: KEY, expectedSource: SOURCE, now: NOW
  }), 'GDPR_EXTERNAL_EVIDENCE_ANCHOR_MISMATCH');
  fails(() => check(bundle, { secret: OTHER_KEY }),
    'GDPR_EXTERNAL_EVIDENCE_SIGNATURE_MISMATCH');
});

test('removing a deleted-account event, editing details, or changing manifest counts is detected', () => {
  const bundle = sign();
  const dropped = structuredClone(bundle);
  dropped.events.pop();
  fails(() => check(dropped), 'GDPR_EXTERNAL_EVIDENCE_DIGEST_MISMATCH');

  const mutated = structuredClone(bundle);
  mutated.events[0].details.counts.choices = 999;
  fails(() => check(mutated), 'GDPR_EXTERNAL_EVIDENCE_DIGEST_MISMATCH');

  const count = structuredClone(bundle);
  count.manifest.count = 1;
  fails(() => check(count), 'GDPR_EXTERNAL_EVIDENCE_DIGEST_MISMATCH');
});

test('injected unsigned event fields are rejected, not silently removed before hashing', () => {
  const original = sign();
  const injected = structuredClone(original);
  injected.events[0].unexpected_personal_data = 'synthetic-extra-pii';
  fails(() => check(injected), 'GDPR_EXTERNAL_EVIDENCE_INVALID');

  const addedBeforeSigning = EVENTS.map(event => ({ ...event }));
  addedBeforeSigning[1].recovery_debug_field = 'synthetic-unexpected';
  fails(() => sign(addedBeforeSigning), 'GDPR_EXTERNAL_EVIDENCE_INVALID');

  const nonEnumerable = structuredClone(original);
  Object.defineProperty(nonEnumerable.events[0], 'hidden_data', {
    value: 'synthetic-hidden', enumerable: false
  });
  fails(() => check(nonEnumerable), 'GDPR_EXTERNAL_EVIDENCE_INVALID');
});

test('injected unsigned bundle properties cannot be accepted as signed evidence', () => {
  const original = sign();
  fails(() => check({ ...original, externalNote: 'synthetic-unsigned' }),
    'GDPR_EXTERNAL_EVIDENCE_INVALID');
  const symbolKey = Symbol('synthetic-unsigned');
  const altered = structuredClone(original);
  altered[symbolKey] = 'synthetic-unsigned';
  fails(() => check(altered), 'GDPR_EXTERNAL_EVIDENCE_INVALID');
});

test('nested hidden, symbol and accessor properties are not silently excluded from integrity proof', () => {
  const hidden = structuredClone(sign());
  Object.defineProperty(hidden.events[0].details.counts, 'hidden_id', {
    value: 'synthetic-private-value', enumerable: false
  });
  fails(() => check(hidden), 'GDPR_EXTERNAL_EVIDENCE_INVALID');

  const symbol = structuredClone(sign());
  symbol.events[0].details[Symbol('synthetic-secret')] = 'not-hashed';
  fails(() => check(symbol), 'GDPR_EXTERNAL_EVIDENCE_INVALID');

  const getter = structuredClone(sign());
  Object.defineProperty(getter.events[0].details.counts, 'deleted', {
    get() { throw new Error('UNSAFE_GETTER_INVOKED'); },
    enumerable: true, configurable: true
  });
  fails(() => check(getter), 'GDPR_EXTERNAL_EVIDENCE_INVALID');

  const beforeSeal = structuredClone(EVENTS);
  Object.defineProperty(beforeSeal[0].details, 'invisible', {
    value: true, enumerable: false
  });
  fails(() => sign(beforeSeal), 'GDPR_EXTERNAL_EVIDENCE_INVALID');
});

test('nested array metadata, sparse entries and accessors cannot bypass signed JSON checks', () => {
  const events = structuredClone(EVENTS);
  events[0].details.positions = [1, 2];
  const extra = structuredClone(sign(events));
  extra.events[0].details.positions[Symbol('extra')] = 'synthetic-unsigned';
  fails(() => check(extra), 'GDPR_EXTERNAL_EVIDENCE_INVALID');

  const hidden = structuredClone(sign(events));
  Object.defineProperty(hidden.events[0].details.positions, 'audit_hint', {
    value: 'synthetic-unsigned', enumerable: false
  });
  fails(() => check(hidden), 'GDPR_EXTERNAL_EVIDENCE_INVALID');

  const sparse = structuredClone(sign(events));
  delete sparse.events[0].details.positions[0];
  sparse.events[0].details.positions.additional = 'synthetic-unsigned';
  fails(() => check(sparse), 'GDPR_EXTERNAL_EVIDENCE_INVALID');

  const accessor = structuredClone(sign(events));
  Object.defineProperty(accessor.events[0].details.positions, '0', {
    get() { throw new Error('UNSAFE_GETTER_INVOKED'); },
    enumerable: true, configurable: true
  });
  fails(() => check(accessor), 'GDPR_EXTERNAL_EVIDENCE_INVALID');
});

test('even a newly re-signed truncated copy cannot match the independently pinned signature', () => {
  const original = sign();
  const truncated = sign(EVENTS.slice(0, 1));
  assert.notEqual(original.signature, truncated.signature);
  fails(() => check(truncated, { expectedSignature: original.signature }),
    'GDPR_EXTERNAL_EVIDENCE_SIGNATURE_MISMATCH');
});

test('wrong source, wrong predecessor checkpoint, or weak key cannot attest', () => {
  const bundle = sign();
  fails(() => check(bundle, { expectedSource: 'gdpr_other_project' }),
    'GDPR_EXTERNAL_EVIDENCE_ANCHOR_MISMATCH');
  fails(() => check(bundle, { expectedPreviousSignature: 'a'.repeat(64) }),
    'GDPR_EXTERNAL_EVIDENCE_ANCHOR_MISMATCH');
  fails(() => check(bundle, { secret: Buffer.alloc(8) }),
    'GDPR_EXTERNAL_EVIDENCE_KEY_REQUIRED');
});

test('stale, implausibly future, or invalid capture time cannot pass freshness gate', () => {
  const bundle = sign();
  fails(() => check(bundle, { now: NOW + 2 * 3600000 }),
    'GDPR_EXTERNAL_EVIDENCE_STALE');
  fails(() => check(bundle, { now: NOW - 3600000 }),
    'GDPR_EXTERNAL_EVIDENCE_STALE');
  for (const maxAgeMs of [NaN, Infinity, -1, 0]) {
    fails(() => check(bundle, { maxAgeMs }), 'GDPR_EXTERNAL_EVIDENCE_INVALID');
  }
  fails(() => sealOffline({
    events: EVENTS, source: SOURCE, capturedAt: '2026-02-30T18:45:00Z'
  }, KEY), 'GDPR_EXTERNAL_EVIDENCE_INVALID');
});

test('duplicate event IDs, inverted event order and equal-time conflicting consents are rejected', () => {
  const duplicate = EVENTS.map(row => ({ ...row }));
  duplicate[1].event_key = duplicate[0].event_key;
  fails(() => sign(duplicate), 'GDPR_EXTERNAL_EVIDENCE_INVALID');
  fails(() => sign(EVENTS.slice().reverse()), 'GDPR_EXTERNAL_EVIDENCE_EVENT_ORDER');
  const ambiguous = [
    EVENTS[0],
    { ...EVENTS[0], event_key: 'synthetic-tie',
      event_type: 'political_consent_granted' }
  ];
  fails(() => sign(ambiguous), 'GDPR_EXTERNAL_EVIDENCE_AMBIGUOUS_CONSENT');
});

test('chronological ordering uses normalized microseconds, not timestamp string spelling', () => {
  const chronological = [
    { ...EVENTS[0], occurred_at: '2026-10-27T18:43:00.123Z' },
    { ...EVENTS[1], occurred_at: '2026-10-27T18:43:00.123001Z' }
  ];
  const verified = check(sign(chronological));
  assert.equal(verified.eventCount, 2);
  fails(() => sign(chronological.slice().reverse()),
    'GDPR_EXTERNAL_EVIDENCE_EVENT_ORDER');
});

test('equivalent timestamp spellings cannot hide conflicting consent events', () => {
  const conflicting = [
    { ...EVENTS[0], event_key: 'synthetic-first',
      occurred_at: '2026-10-27T18:43:00.123000Z' },
    { ...EVENTS[0], event_key: 'synthetic-second',
      event_type: 'political_consent_granted',
      occurred_at: '2026-10-27T18:43:00.123Z' }
  ];
  fails(() => sign(conflicting), 'GDPR_EXTERNAL_EVIDENCE_AMBIGUOUS_CONSENT');
});

test('empty signed archive does not magically demonstrate historical completeness', () => {
  const bundle = sign([]);
  const report = check(bundle);
  assert.equal(report.eventCount, 0);
  assert.equal(report.externalLedgerCompletenessAttested, false);
  assert.equal(report.recoveryApproved, false);
});

test('event details are canonically hashed independent of JSON object property order', () => {
  const opposite = EVENTS.map(x => ({ ...x }));
  opposite[0] = { ...opposite[0], details: {
    counts: { choices: 2, deleted: 3 }, source: 'ci'
  } };
  assert.equal(sign(EVENTS).manifest.eventsSha256,
    sign(opposite).manifest.eventsSha256);
});

test('no acceptance of non-JSON objects or weak nested type serialization', () => {
  const event = { ...EVENTS[0], details: { payload: new Date() } };
  fails(() => sign([event]), 'GDPR_EXTERNAL_EVIDENCE_INVALID');
  const nested = { ...EVENTS[0], details: { payload: undefined } };
  fails(() => sign([nested]), 'GDPR_EXTERNAL_EVIDENCE_INVALID');
});
