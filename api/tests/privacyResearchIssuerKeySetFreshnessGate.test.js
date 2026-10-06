const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertFreshnessMargin,
  createResearchIssuerKeySetFreshnessGate
} = require('../services/researchIssuerKeySetFreshnessGate');

const makeStore = ({ readiness, resolved = { key: 'fixture' } }) => ({
  readiness: () => readiness(),
  resolve: () => resolved
});

test('fresh key-set remains ready and resolution passes through', () => {
  const now = Date.UTC(2026, 9, 3, 15, 0, 0);
  const store = makeStore({
    readiness: () => ({
      ready: true,
      sequence: 12,
      expiresAt: now + 60 * 60 * 1000
    })
  });
  const gate = createResearchIssuerKeySetFreshnessGate({
    snapshotStore: store,
    minimumRemainingValidityMs: 15 * 60 * 1000,
    now: () => now
  });

  assert.deepEqual(gate.readiness(), {
    ready: true,
    sequence: 12,
    expiresAt: now + 60 * 60 * 1000
  });
  assert.deepEqual(gate.resolve({ tokenKeyId: Buffer.alloc(32), epoch: '2026-Q4' }), { key: 'fixture' });
});

test('key-set inside the configured freshness window fails closed before absolute expiry', () => {
  const now = Date.UTC(2026, 9, 3, 15, 0, 0);
  let resolveCalls = 0;
  const store = {
    readiness: () => ({
      ready: true,
      sequence: 13,
      expiresAt: now + 5 * 60 * 1000
    }),
    resolve: () => {
      resolveCalls += 1;
      return { key: 'must-not-be-returned' };
    }
  };
  const gate = createResearchIssuerKeySetFreshnessGate({
    snapshotStore: store,
    minimumRemainingValidityMs: 15 * 60 * 1000,
    now: () => now
  });

  assert.deepEqual(gate.readiness(), {
    ready: false,
    reason: 'freshness-window',
    sequence: 13,
    expiresAt: now + 5 * 60 * 1000
  });
  assert.equal(gate.resolve({}), null);
  assert.equal(resolveCalls, 0);
});

test('missing, expired and malformed upstream state remain fail closed', () => {
  const now = Date.UTC(2026, 9, 3, 15, 0, 0);
  const createGate = (state) => createResearchIssuerKeySetFreshnessGate({
    snapshotStore: makeStore({ readiness: () => state }),
    minimumRemainingValidityMs: 60_000,
    now: () => now
  });

  assert.deepEqual(createGate({ ready: false, reason: 'missing' }).readiness(), {
    ready: false,
    reason: 'missing'
  });
  assert.deepEqual(createGate({ ready: false, reason: 'expired' }).readiness(), {
    ready: false,
    reason: 'expired'
  });
  assert.deepEqual(createGate({ ready: true, sequence: 0, expiresAt: now + 60_000 }).readiness(), {
    ready: false,
    reason: 'invalid-snapshot-state'
  });
  assert.deepEqual(createGate({ ready: true, sequence: 1, expiresAt: now }).readiness(), {
    ready: false,
    reason: 'expired'
  });
});

test('resolution fails closed if freshness expires during store resolution', () => {
  const baseNow = Date.UTC(2026, 9, 3, 15, 0, 0);
  let observedNow = baseNow;
  const store = {
    readiness: () => ({
      ready: true,
      sequence: 20,
      expiresAt: baseNow + 120_000
    }),
    resolve: () => {
      observedNow = baseNow + 90_001;
      return { key: 'fixture' };
    }
  };
  const gate = createResearchIssuerKeySetFreshnessGate({
    snapshotStore: store,
    minimumRemainingValidityMs: 30_000,
    now: () => observedNow
  });

  assert.equal(gate.resolve({}), null);
});

test('resolution fails closed if snapshot generation changes during store resolution', () => {
  const now = Date.UTC(2026, 9, 3, 15, 0, 0);
  let sequence = 30;
  const store = {
    readiness: () => ({
      ready: true,
      sequence,
      expiresAt: now + 120_000
    }),
    resolve: () => {
      sequence = 31;
      return { key: 'fixture' };
    }
  };
  const gate = createResearchIssuerKeySetFreshnessGate({
    snapshotStore: store,
    minimumRemainingValidityMs: 30_000,
    now: () => now
  });

  assert.equal(gate.resolve({}), null);
});

test('resolution fails closed if snapshot expiry metadata changes during store resolution', () => {
  const now = Date.UTC(2026, 9, 3, 15, 0, 0);
  let expiresAt = now + 120_000;
  const store = {
    readiness: () => ({ ready: true, sequence: 40, expiresAt }),
    resolve: () => {
      expiresAt += 1;
      return { key: 'fixture' };
    }
  };
  const gate = createResearchIssuerKeySetFreshnessGate({
    snapshotStore: store,
    minimumRemainingValidityMs: 30_000,
    now: () => now
  });

  assert.equal(gate.resolve({}), null);
});

test('freshness policy requires an explicit positive bounded margin', () => {
  assert.throws(() => assertFreshnessMargin(0), /freshness margin/i);
  assert.throws(() => assertFreshnessMargin(-1), /freshness margin/i);
  assert.throws(() => assertFreshnessMargin(Number.MAX_SAFE_INTEGER), /freshness margin/i);
});

test('freshness gate has no Identity, network or environment dependency', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchIssuerKeySetFreshnessGate.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /axios|jsonwebtoken|middleware\/auth|requireAuth|authenticate/);
  assert.doesNotMatch(source, /\bfetch\s*\(|https?:\/\//);
  assert.doesNotMatch(source, /process\.env/);
});
